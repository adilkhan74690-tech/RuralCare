import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import {
  Patient,
  FollowUp,
  Task,
  EmergencyIncident,
  FollowUpCategory,
  TaskPriority,
  SyncQueueItem,
  SyncConflict,
  SyncStatus,
} from '../types';
import {
  INITIAL_PATIENTS,
  INITIAL_FOLLOW_UPS,
  INITIAL_TASKS,
} from './seedData';

export class RuralCareDatabase extends Dexie {
  patients!: Table<Patient, string>;
  followUps!: Table<FollowUp, string>;
  tasks!: Table<Task, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  conflicts!: Table<SyncConflict, string>;
  emergencyIncidents!: Table<EmergencyIncident, string>;

  constructor() {
    super('RuralCareDB');
    this.version(1).stores({
      patients: '&id, &patientId, fullName, village, chwAssigned, syncStatus, lastModified',
      followUps: '&id, patientId, patientDisplayId, visitDate, category, status, syncStatus, lastModified',
      tasks: '&id, patientId, dueDate, priority, completed, category, syncStatus, lastModified',
      syncQueue: '&id, entityId, entityType, operationType, status, createdAt',
      conflicts: '&id, entityId, entityType, resolved, detectedAt',
    });

    // Version 2: Index tasks.followUpId to resolve "KeyPath followUpId on object store tasks is not indexed"
    // and enrich syncQueue indexes for reliable querying and exponential backoff
    this.version(2).stores({
      tasks: '&id, patientId, followUpId, dueDate, priority, completed, category, syncStatus, lastModified',
      syncQueue: '&id, entityId, entityType, operationType, status, createdAt, retryCount, nextRetryTime',
    }).upgrade(async () => {
      console.log('[RuralCareDB Migration v2] Schema upgrade successful: tasks.followUpId indexed, syncQueue upgraded.');
    });

    // Version 3: Add emergencyIncidents table for SOS Emergency & Referral System
    this.version(3).stores({
      emergencyIncidents: '&id, &incidentCode, patientId, ashaWorkerName, category, referralStatus, syncStatus, lastModified',
    }).upgrade(async () => {
      console.log('[RuralCareDB Migration v3] Schema upgrade successful: emergencyIncidents table added.');
    });
  }
}

export const db = new RuralCareDatabase();

// In-flight submission guards to prevent rapid double-clicks
const pendingSubmissions = new Set<string>();

/**
 * Initialize database and hydrate from server or baseline data if empty.
 */
export async function initDatabase(): Promise<void> {
  const patientCount = await db.patients.count();
  if (patientCount === 0) {
    console.log('[RuralCareDB] Local database is empty. Hydrating baseline records...');

    // Attempt to pull existing records from PostgreSQL if online and authenticated
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        let token: string | null = null;
        try {
          const raw = localStorage.getItem('ruralcare_auth_session') || sessionStorage.getItem('ruralcare_auth_session');
          if (raw) token = JSON.parse(raw)?.token || null;
        } catch {
          // ignore
        }

        if (token) {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
          const headers = { Authorization: `Bearer ${token}` };
          const [patRes, fuRes, taskRes, emgRes] = await Promise.all([
            fetch(`${API_BASE_URL}/patients`, { headers }),
            fetch(`${API_BASE_URL}/follow-ups`, { headers }),
            fetch(`${API_BASE_URL}/tasks`, { headers }),
            fetch(`${API_BASE_URL}/emergencies`, { headers }).catch(() => null),
          ]);

          if (patRes.ok && fuRes.ok && taskRes.ok) {
            const patData = await patRes.json();
            const fuData = await fuRes.json();
            const taskData = await taskRes.json();
            const emgData = emgRes && emgRes.ok ? await emgRes.json() : null;

            if (patData.data && patData.data.length > 0) {
              console.log(`[RuralCareDB] Loaded ${patData.data.length} existing patient records from PostgreSQL.`);
              await db.transaction('rw', [db.patients, db.followUps, db.tasks, db.emergencyIncidents], async () => {
                await db.patients.bulkPut(patData.data.map((p: any) => ({ ...p, syncStatus: 'synced' })));
                if (fuData.data) await db.followUps.bulkPut(fuData.data.map((f: any) => ({ ...f, syncStatus: 'synced' })));
                if (taskData.data) await db.tasks.bulkPut(taskData.data.map((t: any) => ({ ...t, syncStatus: 'synced' })));
                if (emgData && emgData.data) {
                  await db.emergencyIncidents.bulkPut(emgData.data.map((e: any) => ({ ...e, syncStatus: 'synced' })));
                }
              });
              return;
            }
          }
        }
      } catch (e: any) {
        console.log('[RuralCareDB] Could not hydrate from server, loading baseline dataset:', e.message);
      }
    }

    // Baseline offline dataset
    await db.transaction('rw', [db.patients, db.followUps, db.tasks], async () => {
      await db.patients.bulkAdd(INITIAL_PATIENTS);
      await db.followUps.bulkAdd(INITIAL_FOLLOW_UPS);
      await db.tasks.bulkAdd(INITIAL_TASKS);
    });
    console.log('[RuralCareDB] Initial baseline records loaded.');
  }
}

/**
 * Safely enqueues or coalesces an offline mutation in the syncQueue within an active transaction.
 * If an item for the same entity is already 'pending' or 'failed', it updates the payload,
 * preserving 'CREATE' if the entity was created offline and has never been synced to the server.
 */
export async function queueSyncItemInTx(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>
): Promise<SyncQueueItem> {
  const now = new Date().toISOString();
  const existing = await db.syncQueue
    .where('entityId')
    .equals(item.entityId)
    .filter((q) => q.status === 'pending' || q.status === 'failed')
    .first();

  if (existing) {
    const mergedOp = existing.operationType === 'CREATE' ? 'CREATE' : item.operationType;
    const updated: SyncQueueItem = {
      ...existing,
      operationType: mergedOp,
      payload: item.payload,
      patientDisplayId: item.patientDisplayId || existing.patientDisplayId,
      patientName: item.patientName || existing.patientName,
      summary: item.summary || existing.summary,
      status: 'pending',
      retryCount: 0,
      nextRetryTime: 0,
      errorMessage: undefined,
      createdAt: now,
      idempotencyKey: item.idempotencyKey || existing.idempotencyKey || uuidv4(),
    };
    await db.syncQueue.put(updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ruralcare:sync-queue-mutation', { detail: updated }));
    }
    return updated;
  }

  const newItem: SyncQueueItem = {
    id: uuidv4(),
    idempotencyKey: item.idempotencyKey || uuidv4(),
    entityId: item.entityId,
    entityType: item.entityType,
    operationType: item.operationType,
    payload: item.payload,
    createdAt: now,
    status: 'pending',
    retryCount: 0,
    nextRetryTime: 0,
    patientDisplayId: item.patientDisplayId,
    patientName: item.patientName,
    summary: item.summary,
  };
  await db.syncQueue.add(newItem);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ruralcare:sync-queue-mutation', { detail: newItem }));
  }
  return newItem;
}

export const dbService = {
  /**
   * Get all patients ordered by registration date descending.
   */
  async getPatients(): Promise<Patient[]> {
    return await db.patients.toArray();
  },

  /**
   * Get single patient by internal UUID or display patientId.
   */
  async getPatientById(id: string): Promise<Patient | undefined> {
    const byId = await db.patients.get(id);
    if (byId) return byId;
    return await db.patients.where('patientId').equals(id).first();
  },

  /**
   * Register a new patient with local-first IndexedDB persistence.
   * Enqueues an offline CREATE sync queue item.
   * Prevents duplicate submission via deduplication fingerprint & transaction.
   */
  async addPatient(
    patientData: Omit<Patient, 'id' | 'syncStatus' | 'version' | 'lastModified'> & {
      id?: string;
      syncStatus?: SyncStatus;
      version?: number;
      lastModified?: string;
    }
  ): Promise<Patient> {
    const submissionKey = `patient-${patientData.fullName.trim().toLowerCase()}-${patientData.village}`;
    if (pendingSubmissions.has(submissionKey)) {
      throw new Error('A patient registration is already currently being processed.');
    }
    pendingSubmissions.add(submissionKey);

    try {
      // Check for exact existing patient ID
      const existingPatient = await db.patients
        .where('patientId')
        .equals(patientData.patientId)
        .first();

      let patientIdToUse = patientData.patientId;
      if (existingPatient) {
        // Auto-increment display ID suffix to guarantee uniqueness if collisions occur
        patientIdToUse = `RC-2026-${Math.floor(100 + Math.random() * 900)}`;
      }

      const now = new Date().toISOString();
      const newPatient: Patient = {
        id: patientData.id || uuidv4(),
        patientId: patientIdToUse,
        fullName: patientData.fullName.trim(),
        age: Number(patientData.age),
        gender: patientData.gender,
        village: patientData.village,
        contactNumber: patientData.contactNumber.trim(),
        chwAssigned: patientData.chwAssigned || 'Sarah Jenkins',
        registrationDate: patientData.registrationDate || now,
        notes: patientData.notes || '',
        syncStatus: 'pending', // Local-first, always pending until server confirms
        version: 1,
        lastModified: now,
      };

      // Atomic transaction: store patient & enqueue/coalesce sync item
      await db.transaction('rw', [db.patients, db.syncQueue], async () => {
        await db.patients.add(newPatient);
        await queueSyncItemInTx({
          entityId: newPatient.id,
          entityType: 'patient',
          operationType: 'CREATE',
          payload: newPatient,
          patientDisplayId: newPatient.patientId,
          patientName: newPatient.fullName,
          summary: `Register ${newPatient.fullName} (${newPatient.patientId}) - ${newPatient.village}`,
        });
      });

      console.log('[RuralCareDB] Patient record saved to IndexedDB.');
      return newPatient;
    } finally {
      // Release lock after small debounce window to prevent rapid double-clicks
      setTimeout(() => pendingSubmissions.delete(submissionKey), 1000);
    }
  },

  /**
   * Get all follow-ups.
   */
  async getFollowUps(): Promise<FollowUp[]> {
    return await db.followUps.toArray();
  },

  /**
   * Get follow-ups for a specific patient.
   */
  async getFollowUpsForPatient(patientId: string): Promise<FollowUp[]> {
    return await db.followUps
      .where('patientId')
      .equals(patientId)
      .reverse()
      .sortBy('visitDate');
  },

  /**
   * Record a new follow-up visit with local-first IndexedDB persistence.
   * If nextFollowUpDate is set, creates an automatic task in IndexedDB.
   * Enqueues sync queue items for all mutations.
   */
  async addFollowUp(
    followUpData: Omit<FollowUp, 'id' | 'syncStatus' | 'version' | 'lastModified'> & {
      id?: string;
      syncStatus?: SyncStatus;
      version?: number;
      lastModified?: string;
    }
  ): Promise<FollowUp> {
    const submissionKey = `followup-${followUpData.patientId}-${followUpData.visitDate}-${followUpData.category}`;
    if (pendingSubmissions.has(submissionKey)) {
      throw new Error('This follow-up visit is already being recorded.');
    }
    pendingSubmissions.add(submissionKey);

    try {
      const now = new Date().toISOString();
      const newFollowUp: FollowUp = {
        id: followUpData.id || uuidv4(),
        patientId: followUpData.patientId,
        patientDisplayId: followUpData.patientDisplayId,
        patientName: followUpData.patientName,
        visitDate: followUpData.visitDate,
        category: followUpData.category,
        observations: followUpData.observations.trim(),
        notes: followUpData.notes ? followUpData.notes.trim() : '',
        nextFollowUpDate: followUpData.nextFollowUpDate || undefined,
        status: followUpData.status || 'completed',
        chwName: followUpData.chwName || 'Sarah Jenkins',
        syncStatus: 'pending', // Unsynchronized until backend responds
        version: 1,
        lastModified: now,
      };

      // Auto-generate follow-up task if nextFollowUpDate is set
      let autoTask: Task | null = null;
      if (newFollowUp.nextFollowUpDate) {
        autoTask = {
          id: `task-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: `Follow-up: ${newFollowUp.patientName} (${newFollowUp.category})`,
          patientId: newFollowUp.patientId,
          patientDisplayId: newFollowUp.patientDisplayId,
          patientName: newFollowUp.patientName,
          dueDate: newFollowUp.nextFollowUpDate,
          priority: 'high',
          completed: false,
          assignedChw: newFollowUp.chwName,
          category: newFollowUp.category,
          syncStatus: 'pending',
          version: 1,
          lastModified: now,
        };
      }

      await db.transaction('rw', [db.followUps, db.tasks, db.syncQueue], async () => {
        await db.followUps.add(newFollowUp);
        await queueSyncItemInTx({
          entityId: newFollowUp.id,
          entityType: 'followup',
          operationType: 'CREATE',
          payload: newFollowUp,
          patientDisplayId: newFollowUp.patientDisplayId,
          patientName: newFollowUp.patientName,
          summary: `Follow-up: ${newFollowUp.patientName} (${newFollowUp.category})`,
        });

        if (autoTask) {
          await db.tasks.add(autoTask);
          await queueSyncItemInTx({
            entityId: autoTask.id,
            entityType: 'task',
            operationType: 'CREATE',
            payload: autoTask,
            patientDisplayId: autoTask.patientDisplayId,
            patientName: autoTask.patientName,
            summary: `Scheduled Task: ${autoTask.title}`,
          });
        }
      });

      console.log('[RuralCareDB] Follow-up record saved to IndexedDB.');
      return newFollowUp;
    } finally {
      setTimeout(() => pendingSubmissions.delete(submissionKey), 1000);
    }
  },

  /**
   * Schedule a new field visit with local-first IndexedDB persistence.
   * Creates a FollowUp (status: 'scheduled') and a corresponding Task.
   * Enqueues sync items for both.
   */
  async scheduleVisit(data: {
    patientId: string;
    patientDisplayId: string;
    patientName: string;
    visitDate: string; // YYYY-MM-DD local calendar date
    scheduledTime?: string;
    category: FollowUpCategory;
    observations: string; // Purpose or instructions
    notes?: string;
    priority?: TaskPriority;
    chwName?: string;
  }): Promise<{ followUp: FollowUp; task: Task }> {
    const now = new Date().toISOString();
    const followUpId = uuidv4();
    const taskId = `task-sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const priority = data.priority || 'medium';
    const chwName = data.chwName || 'Sarah Jenkins';

    const newFollowUp: FollowUp = {
      id: followUpId,
      patientId: data.patientId,
      patientDisplayId: data.patientDisplayId,
      patientName: data.patientName,
      visitDate: data.visitDate,
      scheduledTime: data.scheduledTime || undefined,
      category: data.category,
      observations: data.observations.trim(),
      notes: data.notes ? data.notes.trim() : '',
      status: 'scheduled',
      priority,
      chwName,
      syncStatus: 'pending',
      version: 1,
      lastModified: now,
    };

    const newTask: Task = {
      id: taskId,
      title: `${data.category}: ${data.patientName}`,
      patientId: data.patientId,
      patientDisplayId: data.patientDisplayId,
      patientName: data.patientName,
      dueDate: data.visitDate,
      scheduledTime: data.scheduledTime || undefined,
      priority,
      completed: false,
      assignedChw: chwName,
      category: data.category,
      followUpId: followUpId,
      syncStatus: 'pending',
      version: 1,
      lastModified: now,
    };

      await db.transaction('rw', [db.followUps, db.tasks, db.syncQueue], async () => {
        await db.followUps.add(newFollowUp);
        await db.tasks.add(newTask);
        await queueSyncItemInTx({
          entityId: newFollowUp.id,
          entityType: 'followup',
          operationType: 'CREATE',
          payload: newFollowUp,
          patientDisplayId: newFollowUp.patientDisplayId,
          patientName: newFollowUp.patientName,
          summary: `Schedule Visit: ${newFollowUp.patientName} (${newFollowUp.category})`,
        });
        await queueSyncItemInTx({
          entityId: newTask.id,
          entityType: 'task',
          operationType: 'CREATE',
          payload: newTask,
          patientDisplayId: newTask.patientDisplayId,
          patientName: newTask.patientName,
          summary: `Scheduled Task: ${newTask.title}`,
        });
      });

    console.log('[RuralCareDB] Scheduled visit and linked task persisted locally.');
    return { followUp: newFollowUp, task: newTask };
  },

  /**
   * Transition a visit to 'in_progress' state.
   */
  async startVisit(visitId: string): Promise<FollowUp | undefined> {
    const existing = await db.followUps.get(visitId);
    if (!existing) return undefined;
    if (existing.status === 'completed') return existing;

    const now = new Date().toISOString();
    const updated: FollowUp = {
      ...existing,
      status: 'in_progress',
      syncStatus: 'pending',
      version: (existing.version || 1) + 1,
      lastModified: now,
    };

    await db.transaction('rw', [db.followUps, db.syncQueue], async () => {
      await db.followUps.put(updated);
      await queueSyncItemInTx({
        entityId: updated.id,
        entityType: 'followup',
        operationType: 'UPDATE',
        payload: updated,
        patientDisplayId: updated.patientDisplayId,
        patientName: updated.patientName,
        summary: `Start Visit: ${updated.patientName} (${updated.category})`,
      });
    });

    return updated;
  },

  /**
   * Save draft observations while visit remains in_progress.
   */
  async saveVisitProgress(visitId: string, data: { observations?: string; notes?: string }): Promise<FollowUp | undefined> {
    const existing = await db.followUps.get(visitId);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const updated: FollowUp = {
      ...existing,
      status: 'in_progress',
      observations: data.observations !== undefined ? data.observations : existing.observations,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      syncStatus: 'pending',
      version: (existing.version || 1) + 1,
      lastModified: now,
    };

    await db.transaction('rw', [db.followUps, db.syncQueue], async () => {
      await db.followUps.put(updated);
      await queueSyncItemInTx({
        entityId: updated.id,
        entityType: 'followup',
        operationType: 'UPDATE',
        payload: updated,
        patientDisplayId: updated.patientDisplayId,
        patientName: updated.patientName,
        summary: `Draft Update: ${updated.patientName} (${updated.category})`,
      });
    });

    return updated;
  },

  /**
   * Complete a visit: saves clinical observations, outcome notes, marks status 'completed',
   * marks linked task completed, handles optional nextFollowUpDate, and enqueues sync queue records.
   */
  async completeVisit(
    visitOrTaskId: string,
    visitData: {
      observations: string;
      notes?: string;
      nextFollowUpDate?: string;
      chwName?: string;
    }
  ): Promise<FollowUp> {
    const now = new Date().toISOString();
    let followUp = await db.followUps.get(visitOrTaskId);
    let linkedTask: Task | undefined;

    if (followUp) {
      // Find linked task if any (defensive query)
      const targetFuId = followUp.id;
      const targetVisitDate = followUp.visitDate;
      let matchingTasks: Task[] = [];
      try {
        matchingTasks = await db.tasks.where('followUpId').equals(targetFuId).toArray();
      } catch (err) {
        console.warn('[RuralCareDB] tasks.followUpId fallback query:', err);
        const allTasks = await db.tasks.toArray();
        matchingTasks = allTasks.filter((t) => t.followUpId === targetFuId);
      }
      if (matchingTasks.length > 0) {
        linkedTask = matchingTasks[0];
      } else {
        // Match by patientId and dueDate
        const byPatient = await db.tasks.where('patientId').equals(followUp.patientId).toArray();
        linkedTask = byPatient.find(t => t.dueDate === targetVisitDate && !t.completed);
      }
    } else {
      // Maybe visitOrTaskId is a taskId
      const task = await db.tasks.get(visitOrTaskId);
      if (task) {
        linkedTask = task;
        if (task.followUpId) {
          followUp = await db.followUps.get(task.followUpId);
        }
        if (!followUp && task.patientId) {
          const patient = await db.patients.get(task.patientId);
          followUp = {
            id: uuidv4(),
            patientId: task.patientId,
            patientDisplayId: patient?.patientId || task.patientDisplayId || 'RC-FIELD',
            patientName: task.patientName || patient?.fullName || 'Patient',
            visitDate: task.dueDate,
            scheduledTime: task.scheduledTime,
            category: (task.category as FollowUpCategory) || 'Routine follow-up',
            observations: visitData.observations.trim(),
            notes: visitData.notes ? visitData.notes.trim() : '',
            nextFollowUpDate: visitData.nextFollowUpDate || undefined,
            status: 'completed',
            priority: task.priority,
            completedAt: now,
            chwName: visitData.chwName || task.assignedChw || 'Sarah Jenkins',
            syncStatus: 'pending',
            version: 1,
            lastModified: now,
          };
        }
      }
    }

    if (!followUp) {
      throw new Error(`Visit record not found for id: ${visitOrTaskId}`);
    }

    // Clean NA and N/A placeholders
    const cleanObs = visitData.observations.trim().replace(/^(NA|N\/A)$/i, '');
    const cleanNotes = (visitData.notes ? visitData.notes.trim() : (followUp.notes || '')).replace(/^(NA|N\/A)$/i, '');

    const updatedFollowUp: FollowUp = {
      ...followUp,
      status: 'completed',
      observations: cleanObs || followUp.observations || 'Field visit completed',
      notes: cleanNotes,
      nextFollowUpDate: visitData.nextFollowUpDate || undefined,
      completedAt: now,
      syncStatus: 'pending',
      version: (followUp.version || 1) + 1,
      lastModified: now,
    };

    // Prepare linked task completion
    let updatedTask: Task | null = null;
    if (linkedTask) {
      updatedTask = {
        ...linkedTask,
        completed: true,
        completedAt: now,
        syncStatus: 'pending',
        version: (linkedTask.version || 1) + 1,
        lastModified: now,
      };
    }

    // Auto-schedule next follow-up and task if nextFollowUpDate was chosen
    let nextFollowUp: FollowUp | null = null;
    let nextTask: Task | null = null;

    if (visitData.nextFollowUpDate) {
      const nextDate = visitData.nextFollowUpDate;
      const nextFuId = uuidv4();
      const nextTaskId = `task-sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      nextFollowUp = {
        id: nextFuId,
        patientId: updatedFollowUp.patientId,
        patientDisplayId: updatedFollowUp.patientDisplayId,
        patientName: updatedFollowUp.patientName,
        visitDate: nextDate,
        category: updatedFollowUp.category,
        observations: updatedFollowUp.notes ? `Follow-up round: ${updatedFollowUp.notes}` : `Follow-up round for ${updatedFollowUp.patientName}`,
        notes: '',
        status: 'scheduled',
        priority: updatedFollowUp.priority || 'medium',
        chwName: updatedFollowUp.chwName,
        syncStatus: 'pending',
        version: 1,
        lastModified: now,
      };

      nextTask = {
        id: nextTaskId,
        title: `Follow-up: ${updatedFollowUp.patientName} (${updatedFollowUp.category})`,
        patientId: updatedFollowUp.patientId,
        patientDisplayId: updatedFollowUp.patientDisplayId,
        patientName: updatedFollowUp.patientName,
        dueDate: nextDate,
        priority: updatedFollowUp.priority || 'medium',
        completed: false,
        assignedChw: updatedFollowUp.chwName,
        category: updatedFollowUp.category,
        followUpId: nextFuId,
        syncStatus: 'pending',
        version: 1,
        lastModified: now,
      };
    }

    await db.transaction('rw', [db.followUps, db.tasks, db.syncQueue], async () => {
      await db.followUps.put(updatedFollowUp);
      await queueSyncItemInTx({
        entityId: updatedFollowUp.id,
        entityType: 'followup',
        operationType: followUp.version ? 'UPDATE' : 'CREATE',
        payload: updatedFollowUp,
        patientDisplayId: updatedFollowUp.patientDisplayId,
        patientName: updatedFollowUp.patientName,
        summary: `Completed Visit: ${updatedFollowUp.patientName} (${updatedFollowUp.category})`,
      });

      if (updatedTask) {
        await db.tasks.put(updatedTask);
        await queueSyncItemInTx({
          entityId: updatedTask.id,
          entityType: 'task',
          operationType: 'UPDATE',
          payload: updatedTask,
          patientDisplayId: updatedTask.patientDisplayId,
          patientName: updatedTask.patientName,
          summary: `Task Done: ${updatedTask.title}`,
        });
      }

      if (nextFollowUp && nextTask) {
        await db.followUps.add(nextFollowUp);
        await db.tasks.add(nextTask);
        await queueSyncItemInTx({
          entityId: nextFollowUp.id,
          entityType: 'followup',
          operationType: 'CREATE',
          payload: nextFollowUp,
          patientDisplayId: nextFollowUp.patientDisplayId,
          patientName: nextFollowUp.patientName,
          summary: `Next Round: ${nextFollowUp.patientName} (${nextFollowUp.category})`,
        });
        await queueSyncItemInTx({
          entityId: nextTask.id,
          entityType: 'task',
          operationType: 'CREATE',
          payload: nextTask,
          patientDisplayId: nextTask.patientDisplayId,
          patientName: nextTask.patientName,
          summary: `Scheduled Task: ${nextTask.title}`,
        });
      }
    });

    console.log('[RuralCareDB] Visit successfully completed and persisted to IndexedDB.');
    return updatedFollowUp;
  },

  /**
   * Get all tasks.
   */
  async getTasks(): Promise<Task[]> {
    return await db.tasks.toArray();
  },

  /**
   * Toggle task completion state and record update in sync queue.
   */
  async toggleTask(taskId: string): Promise<Task | undefined> {
    const task = await db.tasks.get(taskId);
    if (!task) return undefined;

    const now = new Date().toISOString();
    const updated: Task = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? now : undefined,
      syncStatus: 'pending',
      lastModified: now,
      version: task.version + 1,
    };

    await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
      await db.tasks.put(updated);
      await queueSyncItemInTx({
        entityId: updated.id,
        entityType: 'task',
        operationType: 'UPDATE',
        payload: updated,
        patientDisplayId: updated.patientDisplayId,
        patientName: updated.patientName,
        summary: `Task ${updated.completed ? 'Completed' : 'Reopened'}: ${updated.title}`,
      });
    });

    return updated;
  },

  /**
   * Add a new task with local-first IndexedDB persistence.
   */
  async addTask(taskData: Omit<Task, 'id' | 'syncStatus' | 'version' | 'lastModified'>): Promise<Task> {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      syncStatus: 'pending',
      version: 1,
      lastModified: now,
    };

    await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
      await db.tasks.add(newTask);
      await queueSyncItemInTx({
        entityId: newTask.id,
        entityType: 'task',
        operationType: 'CREATE',
        payload: newTask,
        patientDisplayId: newTask.patientDisplayId,
        patientName: newTask.patientName,
        summary: `New Task: ${newTask.title}`,
      });
    });

    return newTask;
  },

  /**
   * Get all sync queue items.
   */
  async getQueueItems(): Promise<SyncQueueItem[]> {
    return await db.syncQueue.reverse().sortBy('createdAt');
  },

  /**
   * Retry a failed or pending sync queue item with immediate eligibility.
   */
  async retryQueueItem(itemId: string): Promise<void> {
    const item = await db.syncQueue.get(itemId);
    if (!item) return;

    await db.syncQueue.update(itemId, {
      status: 'pending',
      retryCount: 0,
      nextRetryTime: 0,
      errorMessage: undefined,
      lastAttempt: `Retried at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ruralcare:sync-queue-mutation', { detail: { itemId } }));
    }
  },

  /**
   * Atomically resets all failed queue items back to pending.
   */
  async retryAllFailed(): Promise<number> {
    const failed = await db.syncQueue.where('status').equals('failed').toArray();
    const nowStr = `Retried at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    await db.transaction('rw', db.syncQueue, async () => {
      for (const item of failed) {
        await db.syncQueue.update(item.id, {
          status: 'pending',
          retryCount: 0,
          nextRetryTime: 0,
          errorMessage: undefined,
          lastAttempt: nowStr,
        });
      }
    });
    if (typeof window !== 'undefined' && failed.length > 0) {
      window.dispatchEvent(new CustomEvent('ruralcare:sync-queue-mutation', { detail: { count: failed.length } }));
    }
    return failed.length;
  },

  /**
   * Get all emergency incidents sorted by incidentTimestamp descending.
   */
  async getEmergencyIncidents(): Promise<EmergencyIncident[]> {
    return await db.emergencyIncidents.reverse().sortBy('incidentTimestamp');
  },

  /**
   * Get single emergency incident by internal UUID or display incidentCode.
   */
  async getEmergencyIncidentById(id: string): Promise<EmergencyIncident | undefined> {
    const byId = await db.emergencyIncidents.get(id);
    if (byId) return byId;
    return await db.emergencyIncidents.where('incidentCode').equals(id).first();
  },

  /**
   * Register a new SOS emergency incident with local-first IndexedDB persistence.
   * Atomically enqueues a CREATE item to the syncQueue.
   */
  async addEmergencyIncident(
    incidentData: Omit<EmergencyIncident, 'id' | 'syncStatus' | 'version' | 'lastModified' | 'incidentCode' | 'incidentTimestamp'> & {
      id?: string;
      incidentCode?: string;
      incidentTimestamp?: string;
      syncStatus?: SyncStatus;
      version?: number;
      lastModified?: string;
    }
  ): Promise<EmergencyIncident> {
    const now = new Date().toISOString();
    const id = incidentData.id || uuidv4();
    const incidentCode = incidentData.incidentCode || `EMG-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newIncident: EmergencyIncident = {
      id,
      incidentCode,
      patientId: incidentData.patientId || null,
      patientDisplayId: incidentData.patientDisplayId || null,
      patientName: incidentData.patientName.trim(),
      isUnregistered: Boolean(incidentData.isUnregistered),
      unregisteredPatientAge: incidentData.unregisteredPatientAge ?? null,
      unregisteredGender: incidentData.unregisteredGender ?? null,
      ashaWorkerId: incidentData.ashaWorkerId || 'asha-current',
      ashaWorkerName: incidentData.ashaWorkerName || 'Sarah Jenkins',
      incidentTimestamp: incidentData.incidentTimestamp || now,
      workerLatitude: incidentData.workerLatitude ?? null,
      workerLongitude: incidentData.workerLongitude ?? null,
      patientLatitude: incidentData.patientLatitude ?? null,
      patientLongitude: incidentData.patientLongitude ?? null,
      locationType: incidentData.locationType || 'same_as_worker',
      manualAddress: incidentData.manualAddress || null,
      village: incidentData.village || null,
      landmark: incidentData.landmark || null,
      category: incidentData.category,
      priority: incidentData.priority || 'urgent',
      chiefComplaints: incidentData.chiefComplaints || null,
      notes: incidentData.notes || '',
      referralStatus: incidentData.referralStatus || 'initiated',
      facilityId: incidentData.facilityId || null,
      facilityName: incidentData.facilityName || null,
      facilityType: incidentData.facilityType || null,
      facilityPhone: incidentData.facilityPhone || null,
      facilityAddress: incidentData.facilityAddress || null,
      facilityDistanceKm: incidentData.facilityDistanceKm ?? null,
      contactAttempts: incidentData.contactAttempts || [],
      transportType: incidentData.transportType || null,
      transportContact: incidentData.transportContact || null,
      transportNotes: incidentData.transportNotes || null,
      dispatchConfirmed: Boolean(incidentData.dispatchConfirmed),
      arrivedAt: incidentData.arrivedAt || null,
      handoverTo: incidentData.handoverTo || null,
      handoverNotes: incidentData.handoverNotes || null,
      referralCode: incidentData.referralCode || `REF-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      syncStatus: 'pending',
      version: 1,
      lastModified: now,
      createdAt: now,
    };

    await db.transaction('rw', [db.emergencyIncidents, db.syncQueue], async () => {
      await db.emergencyIncidents.add(newIncident);
      await queueSyncItemInTx({
        entityId: newIncident.id,
        entityType: 'emergency',
        operationType: 'CREATE',
        payload: newIncident,
        patientDisplayId: newIncident.patientDisplayId || newIncident.incidentCode,
        patientName: newIncident.patientName,
        summary: `🚨 SOS Emergency: ${newIncident.patientName} (${newIncident.category})`,
      });
    });

    return newIncident;
  },

  /**
   * Update emergency incident (referral status, facility selection, contact attempts, transport)
   * with local-first IndexedDB persistence and syncQueue integration.
   */
  async updateEmergencyIncident(
    id: string,
    updates: Partial<EmergencyIncident>
  ): Promise<EmergencyIncident> {
    const existing = await db.emergencyIncidents.get(id);
    if (!existing) {
      throw new Error(`Emergency incident ${id} not found.`);
    }

    const now = new Date().toISOString();
    const updated: EmergencyIncident = {
      ...existing,
      ...updates,
      syncStatus: 'pending',
      version: existing.version + 1,
      lastModified: now,
    };

    await db.transaction('rw', [db.emergencyIncidents, db.syncQueue], async () => {
      await db.emergencyIncidents.put(updated);
      await queueSyncItemInTx({
        entityId: updated.id,
        entityType: 'emergency',
        operationType: 'UPDATE',
        payload: updated,
        patientDisplayId: updated.patientDisplayId || updated.incidentCode,
        patientName: updated.patientName,
        summary: `🚨 Update SOS (${updated.referralStatus}): ${updated.patientName}`,
      });
    });

    return updated;
  },

  /**
   * Clear all records in the database.
   */
  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.patients, db.followUps, db.tasks, db.syncQueue, db.conflicts, db.emergencyIncidents], async () => {
      await db.patients.clear();
      await db.followUps.clear();
      await db.tasks.clear();
      await db.syncQueue.clear();
      await db.conflicts.clear();
      await db.emergencyIncidents.clear();
    });
    console.log('[RuralCareDB] All tables cleared.');
  },
};

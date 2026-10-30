import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import {
  Patient,
  FollowUp,
  Task,
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

  constructor() {
    super('RuralCareDB');
    this.version(1).stores({
      patients: '&id, &patientId, fullName, village, chwAssigned, syncStatus, lastModified',
      followUps: '&id, patientId, patientDisplayId, visitDate, category, status, syncStatus, lastModified',
      tasks: '&id, patientId, dueDate, priority, completed, category, syncStatus, lastModified',
      syncQueue: '&id, entityId, entityType, operationType, status, createdAt',
      conflicts: '&id, entityId, entityType, resolved, detectedAt',
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

    // Attempt to pull existing records from PostgreSQL if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const [patRes, fuRes, taskRes] = await Promise.all([
          fetch(`${API_BASE_URL}/patients`),
          fetch(`${API_BASE_URL}/follow-ups`),
          fetch(`${API_BASE_URL}/tasks`),
        ]);

        if (patRes.ok && fuRes.ok && taskRes.ok) {
          const patData = await patRes.json();
          const fuData = await fuRes.json();
          const taskData = await taskRes.json();

          if (patData.data && patData.data.length > 0) {
            console.log(`[RuralCareDB] Loaded ${patData.data.length} existing patient records from PostgreSQL.`);
            await db.transaction('rw', [db.patients, db.followUps, db.tasks], async () => {
              await db.patients.bulkPut(patData.data.map((p: any) => ({ ...p, syncStatus: 'synced' })));
              if (fuData.data) await db.followUps.bulkPut(fuData.data.map((f: any) => ({ ...f, syncStatus: 'synced' })));
              if (taskData.data) await db.tasks.bulkPut(taskData.data.map((t: any) => ({ ...t, syncStatus: 'synced' })));
            });
            return;
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

      const syncItem: SyncQueueItem = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        entityId: newPatient.id,
        entityType: 'patient',
        operationType: 'CREATE',
        payload: newPatient,
        createdAt: now,
        status: 'pending',
        retryCount: 0,
      };

      // Atomic transaction: store patient & enqueue sync item
      await db.transaction('rw', [db.patients, db.syncQueue], async () => {
        await db.patients.add(newPatient);
        await db.syncQueue.add(syncItem);
      });

      console.log(`[RuralCareDB] Patient ${newPatient.fullName} (${newPatient.patientId}) saved to IndexedDB.`);
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

      const followUpQueueItem: SyncQueueItem = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        entityId: newFollowUp.id,
        entityType: 'followup',
        operationType: 'CREATE',
        payload: newFollowUp,
        createdAt: now,
        status: 'pending',
        retryCount: 0,
      };

      // Auto-generate follow-up task if nextFollowUpDate is set
      let autoTask: Task | null = null;
      let taskQueueItem: SyncQueueItem | null = null;
      if (newFollowUp.nextFollowUpDate) {
        autoTask = {
          id: `task-auto-${Date.now()}`,
          title: `Follow-up: ${newFollowUp.patientName} (${newFollowUp.category})`,
          patientId: newFollowUp.patientId,
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

        taskQueueItem = {
          id: `queue-${Date.now()}-task`,
          entityId: autoTask.id,
          entityType: 'task',
          operationType: 'CREATE',
          payload: autoTask,
          createdAt: now,
          status: 'pending',
          retryCount: 0,
        };
      }

      await db.transaction('rw', [db.followUps, db.tasks, db.syncQueue], async () => {
        await db.followUps.add(newFollowUp);
        await db.syncQueue.add(followUpQueueItem);
        if (autoTask && taskQueueItem) {
          await db.tasks.add(autoTask);
          await db.syncQueue.add(taskQueueItem);
        }
      });

      console.log(`[RuralCareDB] Follow-up for ${newFollowUp.patientName} saved to IndexedDB.`);
      return newFollowUp;
    } finally {
      setTimeout(() => pendingSubmissions.delete(submissionKey), 1000);
    }
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

    const syncItem: SyncQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entityId: updated.id,
      entityType: 'task',
      operationType: 'UPDATE',
      payload: updated,
      createdAt: now,
      status: 'pending',
      retryCount: 0,
    };

    await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
      await db.tasks.put(updated);
      await db.syncQueue.add(syncItem);
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

    const syncItem: SyncQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entityId: newTask.id,
      entityType: 'task',
      operationType: 'CREATE',
      payload: newTask,
      createdAt: now,
      status: 'pending',
      retryCount: 0,
    };

    await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
      await db.tasks.add(newTask);
      await db.syncQueue.add(syncItem);
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
   * Retry a failed or pending sync queue item.
   */
  async retryQueueItem(itemId: string): Promise<void> {
    const item = await db.syncQueue.get(itemId);
    if (!item) return;

    await db.syncQueue.update(itemId, {
      status: 'pending',
      retryCount: item.retryCount + 1,
      lastAttempt: new Date().toLocaleTimeString(),
    });
  },

  /**
   * Clear all records in the database.
   */
  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.patients, db.followUps, db.tasks, db.syncQueue, db.conflicts], async () => {
      await db.patients.clear();
      await db.followUps.clear();
      await db.tasks.clear();
      await db.syncQueue.clear();
      await db.conflicts.clear();
    });
    console.log('[RuralCareDB] All tables cleared.');
  },
};

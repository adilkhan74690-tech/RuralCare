import { db } from './db';
import { SyncQueueItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface SyncResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  message: string;
  error?: string;
  timestamp: string;
}

/**
 * Checks if the device is currently in genuine online state.
 */
export function isDeviceOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Synchronize all pending syncQueue items with the PostgreSQL backend.
 * ONLY marks records as synced after backend responds with acknowledgement of successful database persistence.
 */
export async function syncPendingRecords(): Promise<SyncResult> {
  const timestamp = new Date().toISOString();

  // 1. Connectivity check
  if (!isDeviceOnline()) {
    console.log('[SyncService] Device is offline. Sync skipped; changes remain queued locally.');
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      message: "You're offline. Changes are saved on this device and queued for sync.",
      timestamp,
    };
  }

  // 2. Fetch pending queue items from Dexie
  const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();

  if (pendingItems.length === 0) {
    console.log('[SyncService] No pending items in queue.');
    return {
      success: true,
      processedCount: 0,
      failedCount: 0,
      message: 'All local records are already synchronized with the server.',
      timestamp,
    };
  }

  console.log(`[SyncService] Sending ${pendingItems.length} pending items to ${API_BASE_URL}/sync...`);

  try {
    const response = await fetch(`${API_BASE_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: pendingItems }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncService] Backend returned HTTP ${response.status}:`, errText);

      // Record attempt on items without marking them as synced
      const nowStr = new Date().toLocaleTimeString();
      await db.transaction('rw', db.syncQueue, async () => {
        for (const item of pendingItems) {
          await db.syncQueue.update(item.id, {
            lastAttempt: nowStr,
            retryCount: (item.retryCount || 0) + 1,
            errorMessage: `Server error: HTTP ${response.status}`,
          });
        }
      });

      return {
        success: false,
        processedCount: 0,
        failedCount: pendingItems.length,
        message: `Sync failed: Server returned HTTP ${response.status}`,
        error: errText,
        timestamp,
      };
    }

    const data: {
      success: boolean;
      processedIds: string[];
      failedItems?: Array<{ id: string; error: string }>;
      syncedAt: string;
    } = await response.json();

    const processedSet = new Set(data.processedIds || []);
    const failedMap = new Map((data.failedItems || []).map((f) => [f.id, f.error]));

    // 3. Atomically update only backend-acknowledged records
    await db.transaction('rw', [db.syncQueue, db.patients, db.followUps, db.tasks], async () => {
      const nowTimeStr = new Date().toLocaleTimeString();

      for (const item of pendingItems) {
        if (processedSet.has(item.id)) {
          // Confirmed persisted in PostgreSQL!
          await db.syncQueue.update(item.id, {
            status: 'synced',
            lastAttempt: nowTimeStr,
            errorMessage: undefined,
          });

          // Update corresponding domain entity syncStatus
          if (item.entityType === 'patient') {
            await db.patients.update(item.entityId, { syncStatus: 'synced' });
          } else if (item.entityType === 'followup') {
            await db.followUps.update(item.entityId, { syncStatus: 'synced' });
          } else if (item.entityType === 'task') {
            await db.tasks.update(item.entityId, { syncStatus: 'synced' });
          }
        } else if (failedMap.has(item.id)) {
          // Backend reported an error for this record
          await db.syncQueue.update(item.id, {
            status: 'failed',
            lastAttempt: nowTimeStr,
            errorMessage: failedMap.get(item.id),
            retryCount: (item.retryCount || 0) + 1,
          });
        }
      }
    });

    console.log(`[SyncService] Successfully synchronized ${data.processedIds.length} items to PostgreSQL.`);

    return {
      success: true,
      processedCount: data.processedIds.length,
      failedCount: (data.failedItems || []).length,
      message: `Synchronized ${data.processedIds.length} record(s) with PostgreSQL.`,
      timestamp: data.syncedAt || timestamp,
    };
  } catch (netError: any) {
    console.error('[SyncService] Network error during synchronization:', netError);

    // Network dropped during sync - items remain pending
    const nowStr = new Date().toLocaleTimeString();
    await db.transaction('rw', db.syncQueue, async () => {
      for (const item of pendingItems) {
        await db.syncQueue.update(item.id, {
          lastAttempt: nowStr,
          retryCount: (item.retryCount || 0) + 1,
          errorMessage: netError.message || 'Network unreachable',
        });
      }
    });

    return {
      success: false,
      processedCount: 0,
      failedCount: pendingItems.length,
      message: 'Network unreachable. Changes remain safely saved offline on this device.',
      error: netError.message,
      timestamp,
    };
  }
}

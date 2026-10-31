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

export interface SyncEngineState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastAttemptTime: string | null;
  lastError: string | null;
}

// Maximum automatic retry attempts before requiring manual intervention
export const MAX_AUTO_RETRIES = 8;

// In-flight concurrency lock to prevent duplicate sync triggers in the current tab
let isSyncInProgress = false;

// Cross-tab mutex key and timeout (25 seconds lease)
const SYNC_LOCK_KEY = 'ruralcare_sync_lock_ts';
const SYNC_LOCK_TIMEOUT_MS = 25000;

function acquireCrossTabLock(): boolean {
  try {
    const raw = localStorage.getItem(SYNC_LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const lockTs = parseInt(raw, 10);
      if (!isNaN(lockTs) && now - lockTs < SYNC_LOCK_TIMEOUT_MS) {
        return false; // Active lock held by another tab
      }
    }
    localStorage.setItem(SYNC_LOCK_KEY, now.toString());
    return true;
  } catch {
    return true; // Fallback if localStorage restricted
  }
}

function releaseCrossTabLock(): void {
  try {
    localStorage.removeItem(SYNC_LOCK_KEY);
  } catch {
    // ignore
  }
}

// Authentication pause flag: pauses automatic background sync when 401/403 is received until re-login
let isAuthPaused = false;

export function pauseAutoSyncForAuth(): void {
  isAuthPaused = true;
  console.warn('[SyncService] Auto-sync paused: central authentication required (401/403).');
}

export function resumeAutoSyncAfterAuth(): void {
  isAuthPaused = false;
  console.log('[SyncService] Auto-sync resumed: user authentication confirmed.');
}

export function isAutoSyncAuthPaused(): boolean {
  return isAuthPaused;
}

// Reactive Sync State Management
type SyncStateListener = (state: SyncEngineState) => void;
const syncStateListeners = new Set<SyncStateListener>();

let currentSyncState: SyncEngineState = {
  isSyncing: false,
  lastSyncTime: 'Initial local cache loaded',
  lastAttemptTime: null,
  lastError: null,
};

export function getSyncState(): SyncEngineState {
  return currentSyncState;
}

export function subscribeSyncState(listener: SyncStateListener): () => void {
  syncStateListeners.add(listener);
  listener(currentSyncState);
  return () => {
    syncStateListeners.delete(listener);
  };
}

function updateSyncState(partial: Partial<SyncEngineState>): void {
  currentSyncState = { ...currentSyncState, ...partial };
  for (const listener of syncStateListeners) {
    try {
      listener(currentSyncState);
    } catch (e) {
      console.warn('[SyncService] Listener notification error:', e);
    }
  }
}

/**
 * Checks if the device is currently in genuine online state according to the browser.
 */
export function isDeviceOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Checks actual backend API reachability rather than trusting navigator.onLine alone.
 * Probes the /api/health endpoint with a fast timeout (3500ms).
 */
export async function checkBackendReachability(timeoutMs = 3500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Retrieve the active user's JWT from secure browser session storage.
 */
export function getStoredAuthToken(): string | null {
  try {
    const raw =
      localStorage.getItem('ruralcare_auth_session') ||
      sessionStorage.getItem('ruralcare_auth_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

/**
 * Translates technical error responses into reassuring, actionable CHW guidance.
 * Never exposes raw SQL, JWTs, or stack traces.
 */
export function sanitizeSyncError(rawError?: string, statusCode?: number): string {
  if (statusCode === 401 || statusCode === 403) {
    return 'Your login session has expired. Please log in again to upload your offline changes.';
  }
  if (statusCode === 409 || rawError?.toLowerCase().includes('conflict') || rawError?.toLowerCase().includes('version')) {
    return 'Record updated on another terminal. Please review this record in the Sync Center.';
  }
  if (statusCode === 429) {
    return 'Server network rate limit active. The device will wait and retry automatically.';
  }
  if (statusCode && statusCode >= 500) {
    return 'The health network server encountered a temporary issue. Your records are safely preserved on this device and will retry.';
  }
  if (!rawError) {
    return 'Sync could not be completed. Records are saved locally and will retry.';
  }
  if (rawError.includes('Failed to fetch') || rawError.includes('Network') || rawError.includes('NetworkError')) {
    return 'Network connection lost. Changes remain safely stored on this device.';
  }
  if (rawError.includes('Forbidden') || rawError.includes('assigned to another')) {
    return 'Permission notice: This record is assigned to another healthcare worker.';
  }
  if (rawError.includes('validation') || rawError.includes('Invalid fields')) {
    return 'A required medical field is missing or invalid. Please inspect and update this record.';
  }
  // Remove technical prefixes and limit length
  const cleaned = rawError.replace(/^(Error:\s*|TypeError:\s*)/i, '').trim();
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
}

/**
 * Calculates exponential backoff delay with random jitter.
 * Base delay: 2s, 4s, 8s, 16s, 32s, max 60s + 0-1000ms jitter.
 */
export function calculateBackoffDelay(retryCount: number): number {
  const base = Math.min(60000, 2000 * Math.pow(2, Math.min(retryCount, 5)));
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

/**
 * Synchronize all pending syncQueue items with the PostgreSQL backend.
 * ONLY marks records as synced after backend responds with acknowledgement of successful database persistence.
 * Enforces server-side authentication with JWT, cross-tab concurrency guard, exponential backoff with jitter, and conflict detection.
 */
export async function syncPendingRecords(options: { forceManual?: boolean } = {}): Promise<SyncResult> {
  const timestamp = new Date().toISOString();
  const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Guard against concurrent executions within this tab
  if (isSyncInProgress) {
    console.log('[SyncService] Synchronization already in progress in this tab. Skipping duplicate invocation.');
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      message: 'Sync is already currently in progress.',
      timestamp,
    };
  }

  // 2. Guard against concurrent executions across multiple browser tabs
  if (!acquireCrossTabLock()) {
    console.log('[SyncService] Synchronization is being handled by another browser tab.');
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      message: 'Sync is currently running in another browser tab.',
      timestamp,
    };
  }

  // 3. Stale recovery: If the page was refreshed or restarted while records were marked 'syncing', reset them to 'pending'
  try {
    const staleSyncing = await db.syncQueue.where('status').equals('syncing').toArray();
    if (staleSyncing.length > 0) {
      console.log(`[SyncService] Resetting ${staleSyncing.length} interrupted 'syncing' items back to 'pending'.`);
      await db.transaction('rw', db.syncQueue, async () => {
        for (const item of staleSyncing) {
          await db.syncQueue.update(item.id, { status: 'pending' });
        }
      });
    }
  } catch (err) {
    console.warn('[SyncService] Stale recovery check warning:', err);
  }

  // 4. Connectivity check
  if (!isDeviceOnline()) {
    releaseCrossTabLock();
    console.log('[SyncService] Device is offline. Sync skipped; changes remain queued locally.');
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      message: "You're offline. Changes are saved on this device and queued for sync.",
      timestamp,
    };
  }

  // 5. Authentication check
  const token = getStoredAuthToken();
  if (!token) {
    releaseCrossTabLock();
    pauseAutoSyncForAuth();
    console.log('[SyncService] No active authentication session found. Preserving offline records locally.');
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      message: 'Please log in to upload queued records to the central health database.',
      timestamp,
    };
  }

  // 6. Fetch pending queue items from Dexie
  const allPending = await db.syncQueue.where('status').equals('pending').toArray();

  if (allPending.length === 0) {
    releaseCrossTabLock();
    return {
      success: true,
      processedCount: 0,
      failedCount: 0,
      message: 'All local records are already synchronized with the server.',
      timestamp,
    };
  }

  // 7. Filter items based on exponential backoff window and max retry limits (manual sync forces all)
  const nowTs = Date.now();
  const eligibleItems = options.forceManual
    ? allPending
    : allPending.filter((item) => {
        // Skip records exceeding max auto-retries unless forced manually
        if ((item.retryCount || 0) >= MAX_AUTO_RETRIES) {
          return false;
        }
        return !item.nextRetryTime || item.nextRetryTime <= nowTs;
      });

  if (eligibleItems.length === 0) {
    releaseCrossTabLock();
    return {
      success: true,
      processedCount: 0,
      failedCount: 0,
      message: 'Unsynchronized records are currently awaiting retry backoff.',
      timestamp,
    };
  }

  isSyncInProgress = true;
  updateSyncState({
    isSyncing: true,
    lastAttemptTime: `Attempted at ${nowTimeStr}`,
  });

  // 8. Atomically mark eligible items as 'syncing' in Dexie
  await db.transaction('rw', db.syncQueue, async () => {
    for (const item of eligibleItems) {
      await db.syncQueue.update(item.id, {
        status: 'syncing',
        lastAttempt: `Attempted at ${nowTimeStr}`,
      });
    }
  });

  console.log(`[SyncService] Sending ${eligibleItems.length} authenticated pending items to ${API_BASE_URL}/sync...`);

  try {
    const response = await fetch(`${API_BASE_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: eligibleItems }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncService] Backend returned HTTP ${response.status}:`, errText);

      // Pause on authentication errors until re-authentication
      if (response.status === 401 || response.status === 403) {
        pauseAutoSyncForAuth();
      }

      const friendlyMsg = sanitizeSyncError(errText, response.status);

      // Record failure attempt with exponential backoff and jitter without marking as synced
      await db.transaction('rw', db.syncQueue, async () => {
        for (const item of eligibleItems) {
          const retries = (item.retryCount || 0) + 1;
          const isPermanent =
            retries >= MAX_AUTO_RETRIES ||
            (response.status === 400 && friendlyMsg.includes('missing or invalid'));
          const delay = calculateBackoffDelay(retries);

          await db.syncQueue.update(item.id, {
            status: isPermanent ? 'failed' : 'pending',
            lastAttempt: `Failed at ${nowTimeStr}`,
            retryCount: retries,
            nextRetryTime: isPermanent ? 0 : Date.now() + delay,
            errorMessage: friendlyMsg,
          });
        }
      });

      updateSyncState({
        isSyncing: false,
        lastAttemptTime: `Failed at ${nowTimeStr}`,
        lastError: friendlyMsg,
      });

      return {
        success: false,
        processedCount: 0,
        failedCount: eligibleItems.length,
        message: friendlyMsg,
        error: friendlyMsg,
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

    // 9. Atomically update only backend-acknowledged records
    await db.transaction('rw', [db.syncQueue, db.patients, db.followUps, db.tasks, db.conflicts, db.emergencyIncidents], async () => {
      for (const item of eligibleItems) {
        if (processedSet.has(item.id)) {
          // CONFIRMED PERSISTED IN POSTGRESQL!
          await db.syncQueue.update(item.id, {
            status: 'synced',
            lastAttempt: `Synced at ${nowTimeStr}`,
            errorMessage: undefined,
            retryCount: 0,
            nextRetryTime: 0,
          });

          // Update corresponding domain entity syncStatus
          if (item.entityType === 'patient') {
            await db.patients.update(item.entityId, { syncStatus: 'synced' });
          } else if (item.entityType === 'followup') {
            await db.followUps.update(item.entityId, { syncStatus: 'synced' });
          } else if (item.entityType === 'task') {
            await db.tasks.update(item.entityId, { syncStatus: 'synced' });
          } else if (item.entityType === 'emergency') {
            await db.emergencyIncidents.update(item.entityId, { syncStatus: 'synced' });
          }
        } else if (failedMap.has(item.id)) {
          // Backend reported an error/conflict for this specific record
          const rawErr = failedMap.get(item.id) || 'Sync error';
          const friendly = sanitizeSyncError(rawErr);
          const retries = (item.retryCount || 0) + 1;
          const isPermanent =
            retries >= MAX_AUTO_RETRIES ||
            rawErr.toLowerCase().includes('validation') ||
            rawErr.toLowerCase().includes('invalid fields') ||
            rawErr.toLowerCase().includes('assigned to another');
          const delay = calculateBackoffDelay(retries);

          await db.syncQueue.update(item.id, {
            status: 'failed',
            lastAttempt: `Failed at ${nowTimeStr}`,
            errorMessage: friendly,
            retryCount: retries,
            nextRetryTime: isPermanent ? 0 : Date.now() + delay,
          });

          // If version conflict, register in db.conflicts
          if (rawErr.toLowerCase().includes('conflict') || rawErr.toLowerCase().includes('version')) {
            const conflictId = `conflict-${item.id}`;
            const existingConflict = await db.conflicts.get(conflictId);
            if (!existingConflict) {
              await db.conflicts.put({
                id: conflictId,
                entityType: item.entityType,
                entityId: item.entityId,
                localVersion: item.payload,
                serverVersion: null,
                detectedAt: new Date().toISOString(),
                resolved: false,
              });
            }
          }
        } else {
          // Item was not processed by server: reset back to pending safely with backoff
          const retries = (item.retryCount || 0) + 1;
          const delay = calculateBackoffDelay(retries);
          await db.syncQueue.update(item.id, {
            status: 'pending',
            lastAttempt: `Retrying at ${nowTimeStr}`,
            retryCount: retries,
            nextRetryTime: Date.now() + delay,
          });
        }
      }
    });

    console.log(`[SyncService] Successfully synchronized ${data.processedIds.length} items to PostgreSQL.`);

    const successMsg =
      (data.failedItems || []).length > 0
        ? `Synchronized ${data.processedIds.length} record(s). ${data.failedItems?.length} items require review.`
        : `Synchronized ${data.processedIds.length} record(s) with the central database.`;

    updateSyncState({
      isSyncing: false,
      lastSyncTime: data.processedIds.length > 0 ? `Auto-synced ${data.processedIds.length} record(s) at ${nowTimeStr}` : `All records up to date at ${nowTimeStr}`,
      lastAttemptTime: `Attempted at ${nowTimeStr}`,
      lastError: null,
    });

    return {
      success: true,
      processedCount: data.processedIds.length,
      failedCount: (data.failedItems || []).length,
      message: successMsg,
      timestamp: data.syncedAt || timestamp,
    };
  } catch (netError: any) {
    console.error('[SyncService] Network error during synchronization:', netError);

    const friendlyNetMsg = sanitizeSyncError(netError.message);

    // Network dropped during sync - items remain safely pending with exponential backoff
    await db.transaction('rw', db.syncQueue, async () => {
      for (const item of eligibleItems) {
        const retries = (item.retryCount || 0) + 1;
        const delay = calculateBackoffDelay(retries);
        await db.syncQueue.update(item.id, {
          status: 'pending',
          lastAttempt: `Connection dropped at ${nowTimeStr}`,
          retryCount: retries,
          nextRetryTime: Date.now() + delay,
          errorMessage: friendlyNetMsg,
        });
      }
    });

    updateSyncState({
      isSyncing: false,
      lastAttemptTime: `Connection dropped at ${nowTimeStr}`,
      lastError: friendlyNetMsg,
    });

    return {
      success: false,
      processedCount: 0,
      failedCount: eligibleItems.length,
      message: 'Network connection dropped. Changes remain safely stored on this device until signal returns.',
      error: friendlyNetMsg,
      timestamp,
    };
  } finally {
    isSyncInProgress = false;
    releaseCrossTabLock();
  }
}

// Debounce timer for coalescing rapid background sync requests
let autoSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export interface AutoSyncOptions {
  reason?: string;
  force?: boolean;
  immediate?: boolean;
}

/**
 * Request an automatic background synchronization run.
 * Coalesces rapid requests within a 350ms window.
 * Skips unnecessary network requests if queue has zero pending items.
 */
export function requestAutoSync(options: AutoSyncOptions = {}): Promise<SyncResult | null> {
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = null;
  }

  const runSync = async (): Promise<SyncResult | null> => {
    // 1. If auth is paused and not explicitly forced, do not attempt
    if (isAutoSyncAuthPaused() && !options.force) {
      console.log('[AutoSync] Paused: waiting for user authentication.');
      return null;
    }

    // 2. Check offline status
    if (!isDeviceOnline()) {
      console.log('[AutoSync] Device is currently offline; queued changes will sync upon reconnection.');
      return null;
    }

    // 3. Check if there are any pending queue items before touching the network
    try {
      const pendingCount = await db.syncQueue.where('status').equals('pending').count();
      if (pendingCount === 0 && !options.force) {
        // Zero pending items: do not generate unnecessary network traffic!
        return null;
      }
    } catch (e) {
      console.warn('[AutoSync] Error checking pending queue count:', e);
    }

    console.log(`[AutoSync] Triggering background synchronization (reason: ${options.reason || 'unspecified'})...`);
    return syncPendingRecords({ forceManual: options.force });
  };

  if (options.immediate) {
    return runSync();
  }

  return new Promise((resolve) => {
    autoSyncDebounceTimer = setTimeout(async () => {
      autoSyncDebounceTimer = null;
      const res = await runSync();
      resolve(res);
    }, 350);
  });
}

/**
 * Registers Web Background Sync tag with the Service Worker if supported.
 * Falls back safely and gracefully on browsers without Background Sync API support (e.g. iOS Safari).
 */
export async function registerBackgroundSyncTag(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'sync' in reg) {
        await (reg as any).sync.register('ruralcare-sync-queue');
        console.log('[BackgroundSync] Registered background sync tag: ruralcare-sync-queue');
        return true;
      }
    } catch (e) {
      console.warn('[BackgroundSync] Background sync registration skipped or unsupported:', e);
    }
  }
  return false;
}

// Automatically listen to local mutation events and trigger background synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('ruralcare:sync-queue-mutation', () => {
    registerBackgroundSyncTag().catch(() => {});
    requestAutoSync({ reason: 'mutation-queued' });
  });
}


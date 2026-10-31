import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PatientRegistry } from './pages/PatientRegistry';
import { AddPatient } from './pages/AddPatient';
import { PatientDetails } from './pages/PatientDetails';
import { FollowUpManagement } from './pages/FollowUpManagement';
import { TaskManager } from './pages/TaskManager';
import { SyncCenter } from './pages/SyncCenter';
import { Settings } from './pages/Settings';
import { EmergencyAssistance } from './pages/EmergencyAssistance';
import { db, dbService, initDatabase } from './services/db';
import {
  syncPendingRecords,
  isDeviceOnline,
  checkBackendReachability,
  requestAutoSync,
  subscribeSyncState,
  getSyncState,
  isAutoSyncAuthPaused,
  getStoredAuthToken,
  SyncEngineState,
} from './services/syncService';
import { Patient, FollowUp, Task } from './types';

export function App() {
  // Initialize IndexedDB and baseline records
  useEffect(() => {
    initDatabase().catch((err) => {
      console.error('[RuralCareDB] Error initializing IndexedDB:', err);
    });
  }, []);

  // Reactive IndexedDB queries via Dexie useLiveQuery
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const followUps = useLiveQuery(() => db.followUps.toArray(), []) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const queueItems = useLiveQuery(() => db.syncQueue.reverse().sortBy('createdAt'), []) || [];
  const conflicts = useLiveQuery(() => db.conflicts.toArray(), []) || [];

  // Reactive Sync Engine State (automatically synced across background syncs, app triggers, and manual runs)
  const [syncState, setSyncState] = useState<SyncEngineState>(getSyncState());

  useEffect(() => {
    return subscribeSyncState((state) => {
      setSyncState(state);
    });
  }, []);

  // 1. Initial Application Boot Trigger: Check for pending records when authenticated user starts the app
  useEffect(() => {
    const token = getStoredAuthToken();
    if (token && isDeviceOnline() && !isAutoSyncAuthPaused()) {
      db.syncQueue
        .where('status')
        .equals('pending')
        .count()
        .then((pendingCount) => {
          if (pendingCount > 0) {
            console.log(`[App] Initial startup detected ${pendingCount} pending queue item(s). Probing reachability...`);
            checkBackendReachability().then((reachable) => {
              if (reachable) {
                requestAutoSync({ reason: 'app-boot', immediate: true });
              }
            });
          }
        })
        .catch((err) => console.warn('[App] Boot sync check error:', err));
    }
  }, []);

  // 2. Network Restoration Trigger: Probes actual backend reachability upon online event with backoff
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isProbing = false;

    const handleReconnection = async () => {
      if (isProbing) return;
      isProbing = true;

      console.log('[App] Network "online" event detected. Checking backend reachability...');

      const probeAndSync = async (attempt = 1) => {
        const reachable = await checkBackendReachability(3500);
        if (reachable) {
          console.log('[App] Central server reachability confirmed. Initiating automatic background sync...');
          await requestAutoSync({ reason: 'network-restored', immediate: true });
          isProbing = false;
        } else if (attempt <= 3) {
          const delay = attempt * 2500;
          console.log(`[App] Central server not reachable yet (attempt ${attempt}). Retrying probe in ${delay}ms...`);
          reconnectTimer = setTimeout(() => probeAndSync(attempt + 1), delay);
        } else {
          console.warn('[App] Central server unreachable after multiple attempts; periodic background retry will handle.');
          isProbing = false;
        }
      };

      await probeAndSync(1);
    };

    window.addEventListener('online', handleReconnection);

    return () => {
      window.removeEventListener('online', handleReconnection);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // 3. Tab Visibility & Focus Triggers: Automatically resume synchronization when the tab or window becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isDeviceOnline() && !isAutoSyncAuthPaused()) {
        requestAutoSync({ reason: 'tab-visible' });
      }
    };

    const handleFocus = () => {
      if (isDeviceOnline() && !isAutoSyncAuthPaused()) {
        requestAutoSync({ reason: 'window-focus' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 4. Periodic Background Retry: Checks for pending records every 30 seconds while the app is open
  // NOTE: Does NOT create unnecessary network requests when the queue is empty.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const pendingCount = await db.syncQueue.where('status').equals('pending').count();
        if (pendingCount > 0 && isDeviceOnline() && !isAutoSyncAuthPaused()) {
          console.log(`[App] Periodic sync check: ${pendingCount} pending item(s) detected. Running background sync...`);
          await requestAutoSync({ reason: 'periodic-poll' });
        }
      } catch (err) {
        console.warn('[App] Periodic sync check error:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Add Patient handler - Local-First IndexedDB
  const handleAddPatient = async (patient: Patient) => {
    await dbService.addPatient(patient);
  };

  // Add FollowUp handler - Local-First IndexedDB
  const handleAddFollowUp = async (followUp: FollowUp) => {
    await dbService.addFollowUp(followUp);
  };

  // Toggle Task handler - Local-First IndexedDB
  const handleToggleTask = async (taskId: string) => {
    await dbService.toggleTask(taskId);
  };

  // Add Task handler - Local-First IndexedDB
  const handleAddTask = async (task: Task) => {
    await dbService.addTask(task);
  };

  // Trigger Sync handler - Connects to PostgreSQL backend and updates only acknowledged records
  const handleTriggerSync = async () => {
    await syncPendingRecords({ forceManual: true });
  };

  const handleRetryItem = async (itemId: string) => {
    await dbService.retryQueueItem(itemId);
  };

  const handleRetryAllFailed = async () => {
    await dbService.retryAllFailed();
  };

  const handleResolveConflict = async (conflictId: string, _choice: 'LOCAL' | 'SERVER') => {
    await db.conflicts.delete(conflictId);
  };

  // Clear local device data
  const handleClearAll = async () => {
    await dbService.clearAll();
  };

  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;

  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Public Login Page */}
            <Route path="/login" element={<Login />} />

            {/* Protected Application Workspace (/app/*) */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout pendingCount={pendingCount} />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <Dashboard
                    patients={patients}
                    followUps={followUps}
                    tasks={tasks}
                    pendingSyncCount={pendingCount}
                    lastSyncTime={syncState.lastSyncTime}
                    onToggleTask={handleToggleTask}
                  />
                }
              />
              <Route
                path="patients"
                element={<PatientRegistry patients={patients} followUps={followUps} />}
              />
              <Route
                path="patients/new"
                element={<AddPatient onAddPatient={handleAddPatient} />}
              />
              <Route
                path="patients/:id"
                element={
                  <PatientDetails
                    patients={patients}
                    followUps={followUps}
                  />
                }
              />
              <Route
                path="follow-ups"
                element={
                  <FollowUpManagement
                    patients={patients}
                    followUps={followUps}
                    onAddFollowUp={handleAddFollowUp}
                  />
                }
              />
              <Route
                path="tasks"
                element={
                  <TaskManager
                    tasks={tasks}
                    patients={patients}
                    onToggleTask={handleToggleTask}
                    onAddTask={handleAddTask}
                  />
                }
              />
              <Route
                path="sync"
                element={
                  <SyncCenter
                    queueItems={queueItems}
                    conflicts={conflicts}
                    onTriggerSync={handleTriggerSync}
                    onRetryItem={handleRetryItem}
                    onRetryAllFailed={handleRetryAllFailed}
                    onResolveConflict={handleResolveConflict}
                    lastSyncTime={syncState.lastSyncTime}
                    lastAttemptTime={syncState.lastAttemptTime}
                    isSyncing={syncState.isSyncing}
                  />
                }
              />
              <Route
                path="emergency"
                element={<EmergencyAssistance />}
              />
              <Route
                path="settings"
                element={
                  <Settings
                    onClearAll={handleClearAll}
                    patientCount={patients.length}
                    followUpCount={followUps.length}
                    taskCount={tasks.length}
                    queueCount={pendingCount}
                  />
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

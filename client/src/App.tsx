import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AuthProvider } from './context/AuthContext';
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
import { db, dbService, initDatabase } from './services/db';
import { syncPendingRecords, isDeviceOnline } from './services/syncService';
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

  const [lastSyncTime, setLastSyncTime] = useState<string | null>('Initial local cache loaded');
  const [isSyncing, setIsSyncing] = useState(false);

  // Automatic background synchronization upon network reconnection
  useEffect(() => {
    const handleReconnection = () => {
      if (isDeviceOnline()) {
        console.log('[App] Network reconnected. Automatically synchronizing pending queue items...');
        syncPendingRecords()
          .then((res) => {
            if (res.processedCount > 0) {
              setLastSyncTime(`Auto-synced ${res.processedCount} record(s) at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            }
          })
          .catch((err) => console.error('[App] Auto-sync error on reconnect:', err));
      }
    };

    window.addEventListener('online', handleReconnection);

    return () => {
      window.removeEventListener('online', handleReconnection);
    };
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
    setIsSyncing(true);
    try {
      const res = await syncPendingRecords();
      if (res.success && res.processedCount > 0) {
        setLastSyncTime(`Synced ${res.processedCount} record(s) with PostgreSQL at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      } else if (res.success) {
        setLastSyncTime(`All records up to date at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      } else {
        setLastSyncTime(`Sync pending (offline) at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch (err: any) {
      console.error('[Sync] Error during sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    await dbService.retryQueueItem(itemId);
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
                  lastSyncTime={lastSyncTime}
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
                  onResolveConflict={handleResolveConflict}
                  lastSyncTime={lastSyncTime}
                  isSyncing={isSyncing}
                />
              }
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
    </AuthProvider>
  );
}

export default App;

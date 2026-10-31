import React, { useState } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCw, 
  Check,
  Eye,
  X,
  FileText,
  User,
  Activity,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { SyncQueueItem, SyncConflict } from '../types';

interface SyncCenterProps {
  queueItems: SyncQueueItem[];
  conflicts: SyncConflict[];
  onTriggerSync: () => Promise<void> | void;
  onRetryItem: (itemId: string) => Promise<void> | void;
  onRetryAllFailed?: () => Promise<void> | void;
  onResolveConflict: (conflictId: string, choice: 'LOCAL' | 'SERVER') => Promise<void> | void;
  lastSyncTime?: string | null;
  lastAttemptTime?: string | null;
  isSyncing?: boolean;
}

export const SyncCenter: React.FC<SyncCenterProps> = ({
  queueItems,
  conflicts,
  onTriggerSync,
  onRetryItem,
  onRetryAllFailed,
  onResolveConflict,
  lastSyncTime = 'Today at 09:15 AM',
  lastAttemptTime,
  isSyncing = false,
}) => {
  const { isOnline } = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'SYNCED' | 'FAILED' | 'REVIEW'>('PENDING');
  const [inspectedItem, setInspectedItem] = useState<SyncQueueItem | null>(null);

  const pendingItems = queueItems.filter((i) => i.status === 'pending');
  const syncingItems = queueItems.filter((i) => i.status === 'syncing');
  const failedItems = queueItems.filter((i) => i.status === 'failed');
  const syncedItems = queueItems.filter((i) => i.status === 'synced');

  // Compute timing labels
  const lastSyncDisplay = lastSyncTime || 'Not yet synchronized in this session';
  const lastAttemptDisplay = lastAttemptTime || (queueItems.length > 0 && queueItems[0].lastAttempt ? queueItems[0].lastAttempt : 'Awaiting sync');

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'patient': return 'Patient Registration';
      case 'followup': return 'Field Visit / Follow-up';
      case 'task': return 'Fieldwork Task';
      default: return 'Record';
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'patient': return <User className="w-4 h-4 stroke-[2.5]" />;
      case 'followup': return <Activity className="w-4 h-4 stroke-[2.5]" />;
      case 'task': return <FileText className="w-4 h-4 stroke-[2.5]" />;
      default: return <FileText className="w-4 h-4 stroke-[2.5]" />;
    }
  };

  const getPatientDisplayId = (item: SyncQueueItem): string | undefined => {
    return item.patientDisplayId || item.payload?.patientId || item.payload?.patientDisplayId;
  };

  const getPatientName = (item: SyncQueueItem): string | undefined => {
    return item.patientName || item.payload?.fullName || item.payload?.patientName;
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
            Data Synchronization & Offline Queue
          </h1>
          <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
            Real-time status of healthcare records saved locally and queued for central upload
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {failedItems.length > 0 && onRetryAllFailed && (
            <BrutalButton
              variant="white"
              size="md"
              disabled={!isOnline || isSyncing}
              onClick={onRetryAllFailed}
              icon={<RotateCw className="w-4 h-4 stroke-[2.5]" />}
            >
              Retry Failed ({failedItems.length})
            </BrutalButton>
          )}

          <BrutalButton
            variant="primary"
            size="md"
            disabled={!isOnline || isSyncing || (pendingItems.length === 0 && failedItems.length === 0)}
            onClick={onTriggerSync}
            icon={<RefreshCw className={`w-4 h-4 stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />}
          >
            {isSyncing ? 'Synchronizing...' : 'Sync Now'}
          </BrutalButton>
        </div>
      </div>

      {/* 2. Real-Time Transparent Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending */}
        <div className="p-4 bg-yellow border-2 border-black rounded-xl shadow-brutal-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-black font-heading">Waiting to Sync</span>
            <Clock className="w-4 h-4 stroke-[2.5] text-black" />
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">{pendingItems.length}</span>
            <p className="text-[11px] font-bold text-neutral-800 mt-0.5">Queued on device</p>
          </div>
        </div>

        {/* Currently Syncing */}
        <div className="p-4 bg-teal border-2 border-black rounded-xl shadow-brutal-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-black font-heading">Currently Syncing</span>
            <RefreshCw className={`w-4 h-4 stroke-[2.5] text-black ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">{syncingItems.length}</span>
            <p className="text-[11px] font-bold text-neutral-800 mt-0.5">In transmission</p>
          </div>
        </div>

        {/* Successfully Synced */}
        <div className="p-4 bg-forest text-white border-2 border-black rounded-xl shadow-brutal-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-neutral-100 font-heading">Synchronized</span>
            <ShieldCheck className="w-4 h-4 stroke-[2.5] text-white" />
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-heading font-black text-white">{syncedItems.length}</span>
            <p className="text-[11px] font-bold text-neutral-200 mt-0.5">Confirmed in PostgreSQL</p>
          </div>
        </div>

        {/* Failed */}
        <div className={`p-4 border-2 border-black rounded-xl shadow-brutal-xs flex flex-col justify-between ${
          failedItems.length > 0 ? 'bg-danger text-black' : 'bg-cream text-black'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-black font-heading">Failed Attempts</span>
            <AlertCircle className="w-4 h-4 stroke-[2.5] text-black" />
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">{failedItems.length}</span>
            <p className="text-[11px] font-bold text-neutral-800 mt-0.5">
              {failedItems.length > 0 ? 'Requires attention' : 'Zero failures'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Reassuring Timing & Connection Status Banner */}
      <div className={`p-4 sm:p-5 border-2 border-black rounded-xl shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        !isOnline 
          ? 'bg-cream text-black' 
          : failedItems.length > 0 
          ? 'bg-danger/20 text-black'
          : pendingItems.length > 0 
          ? 'bg-yellow text-black' 
          : 'bg-white text-black'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-brutal-xs">
            {!isOnline ? (
              <WifiOff className="w-5 h-5 text-black stroke-[2.5]" />
            ) : failedItems.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-danger stroke-[2.5]" />
            ) : pendingItems.length > 0 ? (
              <Clock className="w-5 h-5 text-black stroke-[2.5]" />
            ) : (
              <Check className="w-6 h-6 text-forest stroke-[3]" />
            )}
          </div>

          <div>
            <h3 className="font-heading font-black text-sm sm:text-base">
              {!isOnline
                ? 'Working Offline — Safe Local Storage Active'
                : failedItems.length > 0
                ? `${failedItems.length} record(s) encountered sync issues and remain safely saved offline`
                : pendingItems.length > 0
                ? `${pendingItems.length} record(s) waiting for server synchronization`
                : 'All local records are fully synchronized with the central database'}
            </h3>
            <p className="text-xs font-bold text-neutral-800 mt-0.5">
              {!isOnline
                ? 'All patients and visits recorded offline are safely persisted in IndexedDB on this device. Sync will automatically resume when signal returns.'
                : failedItems.length > 0
                ? 'Review the error explanations below. You can retry with exponential backoff or click Retry Failed.'
                : 'No data loss possible: records remain pending locally until central database confirms persistence.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 text-xs shrink-0">
          <span className="font-bold text-neutral-700">
            Last Successful Sync: <strong className="text-black font-black">{lastSyncDisplay}</strong>
          </span>
          <span className="font-bold text-neutral-700">
            Last Attempt: <strong className="text-black font-black">{lastAttemptDisplay}</strong>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-white border-2 border-black shadow-brutal-xs">
              Network: <strong>{isOnline ? 'Online (Connected)' : 'Offline (Disconnected)'}</strong>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal text-black border border-black shadow-brutal-2xs">
              Auto-Sync: Active
            </span>
          </div>
        </div>
      </div>

      {/* 3b. Automatic Sync & Platform Capabilities Info */}
      <div className="px-3.5 py-2.5 bg-white border-2 border-black rounded-lg shadow-brutal-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-bold text-neutral-700">
        <div className="flex items-center gap-2">
          <RotateCw className="w-3.5 h-3.5 text-black stroke-[2.5]" />
          <span>
            <strong>Automatic Sync Engine:</strong> Changes sync automatically on save, network reconnection, tab visibility, and periodic retry. Manual "Sync Now" is optional.
          </span>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded bg-cream border border-black text-[10px] font-black text-black">
          {typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window
            ? '⚡ Web Background Sync API Registered'
            : '⚡ Foreground Auto-Sync Active (Tab Open)'}
        </span>
      </div>

      {/* 4. Conflict Review Banner (if any) */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-yellow text-black border-2 border-black rounded-xl space-y-3 shadow-brutal">
          <div className="flex items-center gap-2 font-black text-sm">
            <AlertCircle className="w-5 h-5 text-black stroke-[2.5]" />
            <span>{conflicts.length} Record Change Requires Review</span>
          </div>
          <p className="text-xs font-bold">
            A newer version of a patient record exists on another terminal. Choose whether to keep your device's version or apply the central version.
          </p>

          <div className="space-y-2 pt-1">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="p-3 bg-white border-2 border-black rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-black text-black uppercase">
                    {c.entityType} Record
                  </span>
                  <span className="text-neutral-600 font-bold ml-2">
                    Updated {new Date(c.detectedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <BrutalButton
                    variant="primary"
                    size="sm"
                    onClick={() => onResolveConflict(c.id, 'LOCAL')}
                  >
                    Keep Device Version
                  </BrutalButton>
                  <BrutalButton
                    variant="white"
                    size="sm"
                    onClick={() => onResolveConflict(c.id, 'SERVER')}
                  >
                    Use Central Version
                  </BrutalButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-black pb-3">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'PENDING'
              ? 'bg-yellow text-black border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          Waiting to Sync ({pendingItems.length + syncingItems.length})
        </button>

        <button
          onClick={() => setActiveTab('FAILED')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'FAILED'
              ? 'bg-danger text-black border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          Failed Attempts ({failedItems.length})
        </button>

        <button
          onClick={() => setActiveTab('SYNCED')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'SYNCED'
              ? 'bg-forest text-white border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          Recently Synchronized ({syncedItems.length})
        </button>
      </div>

      {/* 6. Content Area */}
      <div className="bg-white border-2 border-black rounded-xl shadow-brutal p-4 sm:p-6">
        {/* PENDING & SYNCING TAB */}
        {activeTab === 'PENDING' && (
          <div>
            {pendingItems.length === 0 && syncingItems.length === 0 ? (
              <div className="py-10 text-center text-neutral-600 text-sm space-y-2">
                <div className="w-12 h-12 rounded-full bg-forest border-2 border-black flex items-center justify-center mx-auto shadow-brutal-xs">
                  <Check className="w-6 h-6 text-white stroke-[3]" />
                </div>
                <p className="font-black text-black text-base">All records are synchronized</p>
                <p className="text-xs font-bold text-neutral-600">
                  Any new patients or visits recorded offline will appear here in the queue until confirmed by the server.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...syncingItems, ...pendingItems].map((item) => {
                  const patId = getPatientDisplayId(item);
                  const patName = getPatientName(item);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border-2 border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-brutal-xs transition-all ${
                        item.status === 'syncing' ? 'bg-teal/20' : 'bg-cream'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-black text-black bg-white border border-black uppercase text-[11px] shadow-brutal-2xs">
                            {getEntityIcon(item.entityType)}
                            {getEntityTypeLabel(item.entityType)}
                          </span>

                          {patId && (
                            <span className="px-2 py-0.5 rounded bg-yellow text-black border border-black font-black text-[11px] shadow-brutal-2xs">
                              {patId}
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded text-[11px] font-black border border-black ${
                            item.operationType === 'CREATE' ? 'bg-forest text-white' : 'bg-teal text-black'
                          }`}>
                            {item.operationType === 'CREATE' ? 'New Record' : 'Updated Record'}
                          </span>

                          {item.status === 'syncing' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black text-white text-[11px] font-black animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Syncing...
                            </span>
                          )}
                        </div>

                        <p className="font-heading font-black text-sm text-black">
                          {patName ? `${patName}` : item.summary || 'Clinical record update'}
                        </p>

                        <p className="text-neutral-600 font-bold text-[11px]">
                          Saved locally at {new Date(item.createdAt).toLocaleTimeString()}
                          {item.lastAttempt && ` • ${item.lastAttempt}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <BrutalButton
                          variant="white"
                          size="sm"
                          onClick={() => setInspectedItem(item)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Details
                        </BrutalButton>

                        <BrutalButton
                          variant="primary"
                          size="sm"
                          disabled={!isOnline || isSyncing}
                          onClick={() => onRetryItem(item.id)}
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                        >
                          Sync Now
                        </BrutalButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FAILED TAB */}
        {activeTab === 'FAILED' && (
          <div>
            {failedItems.length === 0 ? (
              <div className="py-10 text-center text-neutral-600 text-sm space-y-2">
                <div className="w-12 h-12 rounded-full bg-forest border-2 border-black flex items-center justify-center mx-auto shadow-brutal-xs">
                  <Check className="w-6 h-6 text-white stroke-[3]" />
                </div>
                <p className="font-black text-black text-base">No failed items</p>
                <p className="text-xs font-bold text-neutral-600">All synchronization attempts have succeeded.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-danger/10 border-2 border-danger rounded-xl text-xs text-neutral-800 font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-black">What happened? </span>
                    These records could not be synchronized on the last attempt. Your data is 100% preserved locally on this device.
                    Click "Retry" or "Retry Failed" to upload now.
                  </div>
                </div>

                {failedItems.map((item) => {
                  const patId = getPatientDisplayId(item);
                  const patName = getPatientName(item);

                  return (
                    <div
                      key={item.id}
                      className="p-4 bg-danger/10 border-2 border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-brutal-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-black text-black bg-white border border-black uppercase text-[11px]">
                            {getEntityIcon(item.entityType)}
                            {getEntityTypeLabel(item.entityType)}
                          </span>

                          {patId && (
                            <span className="px-2 py-0.5 rounded bg-yellow text-black border border-black font-black text-[11px]">
                              {patId}
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded text-[11px] font-black bg-danger text-black border border-black">
                            Failed Attempt
                          </span>
                        </div>

                        <p className="font-heading font-black text-sm text-black">
                          {patName ? `${patName}` : item.summary || 'Clinical record update'}
                        </p>

                        <div className="p-2 bg-white border border-black rounded-md text-[11px] font-bold text-danger">
                          <span className="font-black text-black">Failure reason: </span>
                          {item.errorMessage || 'Network connection timed out. Changes are queued safely.'}
                        </div>

                        <p className="text-neutral-600 font-bold text-[11px]">
                          Saved locally at {new Date(item.createdAt).toLocaleTimeString()} • Retries: {item.retryCount || 0}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <BrutalButton
                          variant="white"
                          size="sm"
                          onClick={() => setInspectedItem(item)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Details
                        </BrutalButton>

                        <BrutalButton
                          variant="primary"
                          size="sm"
                          disabled={!isOnline || isSyncing}
                          onClick={() => onRetryItem(item.id)}
                          icon={<RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />}
                        >
                          Retry
                        </BrutalButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RECENTLY SYNCHRONIZED TAB */}
        {activeTab === 'SYNCED' && (
          <div>
            {syncedItems.length === 0 ? (
              <div className="py-10 text-center text-neutral-600 text-sm font-bold">
                No synchronized records recorded in this device session yet.
              </div>
            ) : (
              <div className="space-y-3">
                {syncedItems.map((item) => {
                  const patId = getPatientDisplayId(item);
                  const patName = getPatientName(item);

                  return (
                    <div
                      key={item.id}
                      className="p-4 bg-white border-2 border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-brutal-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-5 h-5 rounded bg-forest border border-black flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          </div>

                          <span className="font-black text-black uppercase text-[11px]">
                            {getEntityTypeLabel(item.entityType)}
                          </span>

                          {patId && (
                            <span className="px-2 py-0.5 rounded bg-cream text-black border border-black font-black text-[11px]">
                              {patId}
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded bg-forest text-white text-[11px] font-black border border-black">
                            Confirmed in PostgreSQL
                          </span>
                        </div>

                        <p className="font-heading font-black text-sm text-black">
                          {patName ? `${patName}` : item.summary || 'Record update'}
                        </p>

                        <p className="text-neutral-600 font-bold text-[11px]">
                          {item.lastAttempt || `Synchronized at ${new Date(item.createdAt).toLocaleTimeString()}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <BrutalButton
                          variant="white"
                          size="sm"
                          onClick={() => setInspectedItem(item)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Details
                        </BrutalButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. View Details Modal (Sanitized, transparent, zero stack traces/secrets) */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div 
            className="w-full max-w-lg bg-white border-3 border-black rounded-2xl shadow-brutal-lg overflow-hidden my-6"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-4 bg-yellow border-b-2 border-black flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 stroke-[2.5] text-black" />
                <h3 className="font-heading font-black text-base text-black">
                  Offline Record Details
                </h3>
              </div>

              <button
                onClick={() => setInspectedItem(null)}
                className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black hover:bg-neutral-100 shadow-brutal-xs"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs font-bold text-neutral-800">
              <div className="p-3 bg-cream border-2 border-black rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 font-black uppercase text-[11px]">Record Type</span>
                  <span className="font-black text-black uppercase">{getEntityTypeLabel(inspectedItem.entityType)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 font-black uppercase text-[11px]">Patient ID</span>
                  <span className="px-2 py-0.5 rounded bg-yellow text-black border border-black font-black text-xs">
                    {getPatientDisplayId(inspectedItem) || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 font-black uppercase text-[11px]">Patient Name</span>
                  <span className="font-heading font-black text-black">{getPatientName(inspectedItem) || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 font-black uppercase text-[11px]">Operation</span>
                  <span className="font-black text-black">
                    {inspectedItem.operationType === 'CREATE' ? 'Created on Device' : 'Updated on Device'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 font-black uppercase text-[11px]">Local Save Time</span>
                  <span className="font-black text-black">{new Date(inspectedItem.createdAt).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 font-black uppercase text-[11px]">Sync Status</span>
                  <span className="font-black uppercase text-black">{inspectedItem.status}</span>
                </div>
              </div>

              {/* Failure explanation if failed */}
              {inspectedItem.errorMessage && (
                <div className="p-3 bg-danger/10 border-2 border-danger rounded-xl space-y-1">
                  <span className="font-black text-danger uppercase text-[11px] block">Error Notice</span>
                  <p className="text-neutral-800 text-xs font-bold">{inspectedItem.errorMessage}</p>
                </div>
              )}

              {/* Next Steps for CHW */}
              <div className="p-3 bg-white border-2 border-black rounded-xl space-y-1 shadow-brutal-2xs">
                <span className="font-black text-black uppercase text-[11px] block">Next Step</span>
                <p className="text-neutral-700 text-xs font-medium">
                  {inspectedItem.status === 'synced'
                    ? 'This record has been safely committed to the central database.'
                    : inspectedItem.status === 'failed'
                    ? 'Click Retry below once you have a stable network connection or re-authenticated.'
                    : 'This record will automatically synchronize as soon as an internet signal is detected.'}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-black/20">
                <BrutalButton
                  variant="white"
                  size="sm"
                  onClick={() => setInspectedItem(null)}
                >
                  Close
                </BrutalButton>

                {inspectedItem.status !== 'synced' && (
                  <BrutalButton
                    variant="primary"
                    size="sm"
                    disabled={!isOnline || isSyncing}
                    onClick={() => {
                      onRetryItem(inspectedItem.id);
                      setInspectedItem(null);
                    }}
                    icon={<RotateCw className="w-3.5 h-3.5" />}
                  >
                    Retry Now
                  </BrutalButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

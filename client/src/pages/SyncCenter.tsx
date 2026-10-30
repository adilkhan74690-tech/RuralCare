import React, { useState } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCw, 
  Check
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
  onResolveConflict: (conflictId: string, choice: 'LOCAL' | 'SERVER') => Promise<void> | void;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}

export const SyncCenter: React.FC<SyncCenterProps> = ({
  queueItems,
  conflicts,
  onTriggerSync,
  onRetryItem,
  onResolveConflict,
  lastSyncTime = 'Today at 09:15 AM',
  isSyncing = false,
}) => {
  const { isOnline } = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'SYNCED' | 'FAILED' | 'REVIEW'>('PENDING');

  const pendingItems = queueItems.filter((i) => i.status === 'pending');
  const failedItems = queueItems.filter((i) => i.status === 'failed');
  const syncedItems = queueItems.filter((i) => i.status === 'synced');

  return (
    <div className="w-full space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
            Data Synchronization
          </h1>
          <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
            Monitor records saved on this device and synchronize with the central health network
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <BrutalButton
            variant="primary"
            size="md"
            disabled={!isOnline || isSyncing || pendingItems.length === 0}
            onClick={onTriggerSync}
            icon={<RefreshCw className={`w-4 h-4 stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />}
          >
            {isSyncing ? 'Synchronizing...' : 'Sync Now'}
          </BrutalButton>
        </div>
      </div>

      {/* 2. Reassuring Status Banner */}
      <div className={`p-5 border-2 border-black rounded-xl shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        !isOnline ? 'bg-cream text-black' : pendingItems.length > 0 ? 'bg-yellow text-black' : 'bg-forest text-white'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-brutal-xs">
            {!isOnline ? (
              <WifiOff className="w-5 h-5 text-black stroke-[2.5]" />
            ) : pendingItems.length > 0 ? (
              <Clock className="w-5 h-5 text-black stroke-[2.5]" />
            ) : (
              <Check className="w-6 h-6 text-black stroke-[3]" />
            )}
          </div>

          <div>
            <h3 className="font-heading font-black text-base">
              {!isOnline
                ? "You are working offline. Your changes are saved locally."
                : pendingItems.length > 0
                ? `${pendingItems.length} record${pendingItems.length === 1 ? '' : 's'} waiting to synchronize.`
                : 'All patient records are synchronized.'}
            </h3>
            <p className={`text-xs font-bold mt-0.5 ${isOnline && pendingItems.length === 0 ? 'text-neutral-100' : 'text-neutral-800'}`}>
              {!isOnline
                ? 'Continue registering patients and logging visits normally. Synchronization will resume when signal returns.'
                : pendingItems.length > 0
                ? 'Your records are queued locally and ready to upload.'
                : `Last synchronized: ${lastSyncTime || 'Just now'}`}
            </p>
          </div>
        </div>

        <div className="text-xs font-black text-black bg-white px-3 py-1.5 rounded-lg border-2 border-black shadow-brutal-xs shrink-0">
          Network: <strong>{isOnline ? 'Connected' : 'Offline'}</strong>
        </div>
      </div>

      {/* 3. Conflict Review Banner (if any) */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-danger text-black border-2 border-black rounded-xl space-y-3 shadow-brutal">
          <div className="flex items-center gap-2 font-black text-sm">
            <AlertCircle className="w-5 h-5 text-black stroke-[2.5]" />
            <span>{conflicts.length} Record Change Requires Review</span>
          </div>
          <p className="text-xs font-bold">
            A record was updated on another terminal while you were editing offline. Review and choose which version to preserve.
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

      {/* 4. Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-black pb-3">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'PENDING'
              ? 'bg-yellow text-black border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          Waiting to Sync ({pendingItems.length})
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

        {failedItems.length > 0 && (
          <button
            onClick={() => setActiveTab('FAILED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'FAILED'
                ? 'bg-danger text-black border-2 border-black shadow-brutal-xs'
                : 'bg-white text-danger hover:bg-cream border-2 border-black shadow-brutal-xs'
            }`}
          >
            Failed Attempts ({failedItems.length})
          </button>
        )}
      </div>

      {/* 5. Content Area */}
      <div className="bg-white border-2 border-black rounded-xl shadow-brutal p-6">
        {activeTab === 'PENDING' && (
          <div>
            {pendingItems.length === 0 ? (
              <div className="py-8 text-center text-neutral-600 text-sm space-y-2">
                <div className="w-12 h-12 rounded-full bg-forest border-2 border-black flex items-center justify-center mx-auto shadow-brutal-xs">
                  <Check className="w-6 h-6 text-white stroke-[3]" />
                </div>
                <p className="font-black text-black text-base">All records are synchronized</p>
                <p className="text-xs font-bold">Any new patients or visits recorded offline will appear here in the queue.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-cream border-2 border-black rounded-lg flex items-center justify-between text-xs shadow-brutal-xs hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-black uppercase">
                          {item.entityType}
                        </span>
                        <span className="text-neutral-700 font-bold">
                          ({item.operationType === 'CREATE' ? 'New record' : 'Updated'})
                        </span>
                      </div>
                      <p className="text-neutral-600 font-bold">
                        Saved locally at {new Date(item.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <BrutalBadge syncStatus="pending" size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'SYNCED' && (
          <div>
            {syncedItems.length === 0 ? (
              <div className="py-8 text-center text-neutral-600 text-sm font-bold">
                No synchronized records in this session yet.
              </div>
            ) : (
              <div className="space-y-3">
                {syncedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white border-2 border-black rounded-lg flex items-center justify-between text-xs shadow-brutal-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-forest border border-black flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      </div>
                      <div>
                        <span className="font-black text-black uppercase">
                          {item.entityType}
                        </span>
                        <span className="text-neutral-600 font-bold ml-2">
                          Synchronized {item.lastAttempt || 'Today'}
                        </span>
                      </div>
                    </div>

                    <BrutalBadge syncStatus="synced" size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'FAILED' && (
          <div className="space-y-3">
            {failedItems.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-danger/15 border-2 border-black rounded-lg flex items-center justify-between text-xs shadow-brutal-xs"
              >
                <div>
                  <span className="font-black text-black uppercase">
                    {item.entityType}
                  </span>
                  <p className="text-neutral-800 font-bold text-[11px] mt-0.5">
                    Sync timed out. Will retry automatically when connected.
                  </p>
                </div>

                <BrutalButton
                  variant="white"
                  size="sm"
                  onClick={() => onRetryItem(item.id)}
                  icon={<RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />}
                >
                  Retry
                </BrutalButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Link } from 'react-router-dom';

interface NetworkBannerProps {
  pendingCount?: number;
}

export const NetworkBanner: React.FC<NetworkBannerProps> = ({ pendingCount = 0 }) => {
  const { isOnline } = useNetworkStatus();

  // If online and fully synced, the status pill in the Navbar is sufficient
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Network status banner"
      className={`
        w-full border-b-2 border-black px-4 sm:px-6 lg:px-8 py-2.5 text-xs font-bold shadow-brutal-xs
        ${!isOnline ? 'bg-yellow text-black' : 'bg-forest text-white'}
      `}
    >
      <div className="w-full flex items-center justify-between gap-3">
        {/* Human-Oriented Connectivity State */}
        <div className="flex items-center gap-2.5">
          {!isOnline ? (
            <div className="flex items-center gap-2 text-black">
              <span className="w-2.5 h-2.5 rounded-full bg-danger border border-black animate-pulse shrink-0" />
              <WifiOff className="w-4 h-4 text-black stroke-[3] shrink-0" />
              <span>
                <strong>Field Offline Mode:</strong> Working without connection. All registrations and logs are securely saved locally on this device.
                {pendingCount > 0 && (
                  <span className="ml-1.5 underline">({pendingCount} queued for auto-sync)</span>
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white">
              <RefreshCw className="w-4 h-4 text-white stroke-[3] animate-spin shrink-0" />
              <span>
                <strong>Connection Restored:</strong> {pendingCount} record{pendingCount === 1 ? '' : 's'} waiting to upload to central database.{' '}
                <Link to="/app/sync" className="underline font-black text-yellow hover:text-white">
                  Open sync terminal →
                </Link>
              </span>
            </div>
          )}
        </div>

        {/* Sync Center link */}
        <div className="flex items-center gap-2">
          <Link
            to="/app/sync"
            className="text-[11px] font-heading font-black text-black px-3 py-1 rounded-md border-2 border-black bg-white hover:bg-cream transition-all shadow-brutal-xs"
          >
            {pendingCount > 0 ? 'Review Queue' : 'Sync Status'}
          </Link>
        </div>
      </div>
    </aside>
  );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, 
  X, 
  UserPlus,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAuth } from '../context/AuthContext';
import { BrutalButton } from './ui/BrutalButton';
import { Logo } from './ui/Logo';
import { NotificationCenter } from './NotificationCenter';

interface NavbarProps {
  onMenuToggle: () => void;
  isSidebarOpen: boolean;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onMenuToggle, 
  isSidebarOpen,
  pendingCount = 0 
}) => {
  const { isOnline } = useNetworkStatus();
  const { user } = useAuth();

  return (
    <header className="bg-white border-b-2 border-black px-4 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-30 shadow-brutal-sm">
      <div className="w-full flex items-center justify-between">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 border-2 border-black rounded-md bg-yellow text-black shadow-brutal-xs hover:bg-yellow-hover transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isSidebarOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
          </button>

          <Logo size="md" to="/app/dashboard" />
        </div>

        {/* Center Neo-Brutalist Connectivity Pill */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/app/sync"
            className="flex items-center gap-2 px-3.5 py-1 rounded-full border-2 border-black bg-cream hover:bg-yellow text-xs font-black text-black shadow-brutal-xs transition-all"
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-danger stroke-[3]" />
                <span className="text-black">Offline Mode</span>
              </>
            ) : pendingCount > 0 ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-black stroke-[3] animate-spin" />
                <span className="text-black">{pendingCount} waiting to sync</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-teal border border-black" />
                <span className="text-black">Live & Synchronized</span>
              </>
            )}
          </Link>
        </div>

        {/* Right Actions: SOS Emergency, Notifications, Register Patient & CHW Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Link
            to="/app/emergency"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md border-2 border-black bg-danger hover:bg-danger-hover text-black text-xs font-black shadow-brutal-xs transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px]"
            title="SOS Emergency Assistance & Referral Portal"
          >
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            <span className="font-heading font-black">🚨 SOS</span>
          </Link>

          <NotificationCenter />

          <Link to="/app/patients/new">
            <BrutalButton
              variant="primary"
              size="sm"
              icon={<UserPlus className="w-4 h-4 stroke-[2.5]" />}
            >
              Register Patient
            </BrutalButton>
          </Link>

          <Link
            to="/app/settings"
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg border-2 border-black bg-white hover:bg-cream shadow-brutal-xs transition-all text-left"
          >
            <div className="w-7 h-7 rounded-md bg-forest text-white font-black text-xs flex items-center justify-center border-2 border-black">
              {user?.name?.slice(0, 2).toUpperCase() || 'SJ'}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-black leading-tight text-black">
                {user?.name || 'Sarah Jenkins'}
              </p>
              <p className="text-[10px] text-neutral-600 font-bold leading-none">
                {user?.villageSector?.split(' ')[0] || 'Ramgarh'} Sector
              </p>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
};

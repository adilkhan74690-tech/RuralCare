import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  CheckSquare,
  RefreshCw,
  Settings,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, pendingCount = 0 }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { name: 'Patients', path: '/app/patients', icon: Users },
    { name: 'Register Patient', path: '/app/patients/new', icon: UserPlus },
    { name: 'Follow-ups', path: '/app/follow-ups', icon: ClipboardList },
    { name: 'Field Tasks', path: '/app/tasks', icon: CheckSquare },
    { name: 'SOS Emergency', path: '/app/emergency', icon: ShieldAlert },
    { 
      name: 'Sync Status', 
      path: '/app/sync', 
      icon: RefreshCw, 
      badge: pendingCount > 0 ? pendingCount : undefined 
    },
    { name: 'Settings', path: '/app/settings', icon: Settings },
  ];

  const handleSignOut = () => {
    logout();
    onClose();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed lg:static top-0 bottom-0 left-0 z-50
          w-64 shrink-0 bg-white border-r-2 border-black flex flex-col justify-between
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between pb-3 border-b-2 border-black">
            <span className="font-heading font-black text-base text-black">
              Navigation
            </span>
            <button
              onClick={onClose}
              className="px-2.5 py-1 border-2 border-black rounded text-xs font-black bg-cream text-black hover:bg-yellow shadow-brutal-xs"
            >
              Close
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all
                    ${
                      isActive
                        ? 'bg-yellow text-black font-black border-2 border-black shadow-brutal-sm'
                        : 'text-black font-bold border-2 border-transparent hover:border-black hover:bg-cream hover:shadow-brutal-xs'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 stroke-[2.5]" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-forest text-white border-2 border-black shadow-brutal-xs">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Session Info & Sign Out */}
        <div className="p-3.5 border-t-2 border-black bg-cream space-y-2.5">
          <div className="px-1">
            <p className="text-xs font-black text-black truncate">{user?.name || 'Sarah Jenkins'}</p>
            <p className="text-[11px] font-bold text-neutral-600 truncate">{user?.villageSector || 'Ramgarh Sector'}</p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-black bg-white hover:bg-danger border-2 border-black rounded-lg shadow-brutal-xs hover:shadow-brutal font-black transition-all"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

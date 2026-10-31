import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { BrutalButton } from './ui/BrutalButton';

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    browserPermission,
    requestBrowserPermission,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    openVisitFromNotification,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border-2 border-black bg-white hover:bg-cream text-black shadow-brutal-xs hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
        title="Fieldwork Reminders & Visit Alerts"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4 stroke-[2.5]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-black text-[10px] font-black border-2 border-black flex items-center justify-center animate-bounce shadow-brutal-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-3 border-black rounded-2xl shadow-brutal-lg z-50 overflow-hidden animate-in fade-in duration-150">
          {/* Header */}
          <div className="p-3.5 bg-yellow border-b-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-sm text-black">
                Fieldwork Alerts
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-black text-white">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 rounded text-black hover:bg-black/10 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="p-1 rounded text-black hover:bg-black/10 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Permission Banner if not granted */}
          {browserPermission !== 'granted' && (
            <div className="p-3 bg-cream border-b-2 border-black text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <p className="font-bold text-neutral-800 leading-tight">
                  Enable device alerts for scheduled rounds:
                </p>
              </div>
              <BrutalButton
                size="sm"
                variant="primary"
                onClick={requestBrowserPermission}
                className="w-full text-center text-xs py-1"
              >
                Allow Browser Notifications
              </BrutalButton>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y-2 divide-black/10">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-neutral-600 space-y-1">
                <p className="font-black text-xs text-black">No active reminders</p>
                <p className="text-[11px] font-bold">
                  Scheduled visits for today will generate alerts here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 transition-colors ${
                    item.read ? 'bg-white' : 'bg-cream/70'
                  } hover:bg-yellow/20`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-black text-xs text-black">
                          {item.patientName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-yellow border border-black text-black">
                          {item.patientDisplayId}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-neutral-700 leading-tight">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-neutral-600 font-medium">
                        {item.message}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        openVisitFromNotification(item.visitId);
                        setIsOpen(false);
                      }}
                      className="px-2 py-1 text-[11px] font-black rounded border-2 border-black bg-yellow hover:bg-yellow-hover text-black shadow-brutal-xs shrink-0 flex items-center gap-1"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Honest Technical Notice */}
          <div className="p-2.5 bg-neutral-100 border-t-2 border-black text-[10px] font-bold text-neutral-600 flex items-start gap-1.5 leading-tight">
            <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
            <span>
              Offline reminders run locally while the app tab is open. Closed-browser background delivery requires push subscription infrastructure.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

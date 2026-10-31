import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NotificationItem, FollowUp, Task, Patient } from '../types';
import { getLocalDateString, isToday, isPastDate, formatTimeDisplay } from '../utils/dateUtils';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  browserPermission: NotificationPermission;
  requestBrowserPermission: () => Promise<NotificationPermission>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  selectedVisitIdForModal: string | null;
  openVisitFromNotification: (visitId: string) => void;
  clearSelectedVisitId: () => void;
  checkAndTriggerReminders: (followUps: FollowUp[], tasks: Task[], patients: Patient[]) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFIED_REGISTRY_KEY = 'ruralcare_notified_visits_v1';
const INAPP_NOTIFICATIONS_KEY = 'ruralcare_inapp_notifications_v1';

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load persisted in-app notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const stored = localStorage.getItem(INAPP_NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedVisitIdForModal, setSelectedVisitIdForModal] = useState<string | null>(null);

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // Save in-app notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(INAPP_NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.warn('[NotificationService] Could not persist in-app notifications:', e);
    }
  }, [notifications]);

  // Request browser permission on explicit user action (never automatically on initial page load)
  const requestBrowserPermission = async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
      if (result === 'granted') {
        new Notification('RuralCare Connect Alerts Active', {
          body: 'You will receive notifications when field visits and patient follow-ups are due.',
          icon: '/favicon.svg',
        });
      }
      return result;
    } catch (err) {
      console.error('[NotificationService] Failed to request permission:', err);
      return 'denied';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const openVisitFromNotification = (visitId: string) => {
    setSelectedVisitIdForModal(visitId);
    // Also mark related notifications as read
    setNotifications((prev) =>
      prev.map((n) => (n.visitId === visitId ? { ...n, read: true } : n))
    );
  };

  const clearSelectedVisitId = () => {
    setSelectedVisitIdForModal(null);
  };

  /**
   * Evaluates scheduled visits against current local calendar time.
   * Checks deduplication registry in localStorage to prevent repeat alerts.
   * Completed visits are never alerted.
   */
  const checkAndTriggerReminders = useCallback(
    (followUps: FollowUp[], tasks: Task[], patients: Patient[]) => {
      const todayStr = getLocalDateString();
      let registry: Record<string, { date: string; timestamp: string; completed?: boolean }> = {};

      try {
        const raw = localStorage.getItem(NOTIFIED_REGISTRY_KEY);
        if (raw) registry = JSON.parse(raw);
      } catch {
        registry = {};
      }

      const newAlerts: NotificationItem[] = [];

      // 1. Check FollowUps scheduled for today or overdue
      for (const fu of followUps) {
        const isCompleted = fu.status === 'completed';
        
        // If completed, update registry to ensure no future reminder fires
        if (isCompleted) {
          if (registry[fu.id] && !registry[fu.id].completed) {
            registry[fu.id].completed = true;
          }
          continue;
        }

        const visitDateStr = fu.visitDate.includes('T') ? fu.visitDate.split('T')[0] : fu.visitDate;
        const isDue = isToday(visitDateStr) || isPastDate(visitDateStr);

        if (!isDue) continue;

        // Has this visit already been notified today?
        const record = registry[fu.id];
        if (record && record.date === todayStr) {
          continue; // Already notified today
        }

        // Register notification to prevent duplicate
        registry[fu.id] = {
          date: todayStr,
          timestamp: new Date().toISOString(),
          completed: false,
        };

        const patient = patients.find((p) => p.id === fu.patientId);
        const displayId = fu.patientDisplayId || patient?.patientId || 'RC-FIELD';
        const pName = fu.patientName || patient?.fullName || 'Patient';
        const timeDisplay = fu.scheduledTime ? ` at ${formatTimeDisplay(fu.scheduledTime)}` : '';
        const overdueText = isPastDate(visitDateStr) ? 'Overdue visit: ' : 'Visit due today: ';

        const alertItem: NotificationItem = {
          id: `notif-${fu.id}-${Date.now()}`,
          visitId: fu.id,
          patientId: fu.patientId,
          patientDisplayId: displayId,
          patientName: pName,
          category: fu.category,
          scheduledDate: visitDateStr,
          scheduledTime: fu.scheduledTime,
          priority: fu.priority || 'medium',
          title: `${overdueText}${pName} (${displayId})`,
          message: `${fu.category}${timeDisplay}. Tap to inspect and record visit.`,
          createdAt: new Date().toISOString(),
          read: false,
        };

        newAlerts.push(alertItem);

        // Fire browser notification if permission is granted
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const browserNotif = new Notification(`RuralCare Alert: ${pName} (${displayId})`, {
              body: `${fu.category}${timeDisplay}. Scheduled for ${fu.visitDate}.`,
              icon: '/favicon.svg',
              tag: `visit-${fu.id}`, // Replaces previous notification if any
            });

            browserNotif.onclick = () => {
              window.focus();
              setSelectedVisitIdForModal(fu.id);
            };
          } catch (e) {
            console.warn('[NotificationService] Browser notification could not fire:', e);
          }
        }
      }

      // Save updated deduplication registry
      try {
        localStorage.setItem(NOTIFIED_REGISTRY_KEY, JSON.stringify(registry));
      } catch (e) {
        console.warn('[NotificationService] Could not persist registry:', e);
      }

      if (newAlerts.length > 0) {
        setNotifications((prev) => [...newAlerts, ...prev].slice(0, 50));
      }
    },
    []
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        browserPermission,
        requestBrowserPermission,
        markAsRead,
        markAllAsRead,
        clearAllNotifications,
        selectedVisitIdForModal,
        openVisitFromNotification,
        clearSelectedVisitId,
        checkAndTriggerReminders,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

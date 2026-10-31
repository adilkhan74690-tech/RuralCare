import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserPlus, 
  ClipboardList,
  MapPin,
  Check,
  ChevronRight,
  Plus,
  ArrowRight,
  Eye,
  CalendarDays,
  Activity,
  ListFilter,
  X
} from 'lucide-react';
import { BrutalCard } from '../components/ui/BrutalCard';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAuth } from '../context/AuthContext';
import { Patient, FollowUp, Task, TaskPriority, FieldworkVisitItem } from '../types';
import { 
  getLocalDateString, 
  isToday, 
  isPastDate, 
  isFutureDate, 
  formatDateDisplay, 
  formatTimeDisplay 
} from '../utils/dateUtils';
import { VisitModal } from '../components/VisitModal';
import { ScheduleVisitModal } from '../components/ScheduleVisitModal';
import { useNotifications } from '../context/NotificationContext';

interface DashboardProps {
  patients: Patient[];
  followUps: FollowUp[];
  tasks: Task[];
  pendingSyncCount: number;
  lastSyncTime?: string | null;
  onToggleTask?: (taskId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  patients,
  followUps,
  tasks,
  pendingSyncCount,
  onToggleTask,
}) => {
  const { isOnline } = useNetworkStatus();
  const { user } = useAuth();
  const { 
    checkAndTriggerReminders, 
    selectedVisitIdForModal, 
    clearSelectedVisitId 
  } = useNotifications();

  // Modal states
  const [selectedVisitItem, setSelectedVisitItem] = useState<FieldworkVisitItem | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false);
  const [viewAllFilter, setViewAllFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED'>('ALL');

  // Trigger reminders evaluation when records change
  useEffect(() => {
    checkAndTriggerReminders(followUps, tasks, patients);
  }, [followUps, tasks, patients, checkAndTriggerReminders]);

  // Current local calendar date (respects user timezone, never UTC-shifted)
  const todayStr = getLocalDateString();

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const workerFirstName = user?.name ? user.name.split(' ')[0] : 'Healthcare Worker';
  const villageZone = user?.villageSector || 'Health Sector';

  // Build unified, deduplicated list of fieldwork visits from FollowUps and Tasks
  const allFieldworkItems = useMemo<FieldworkVisitItem[]>(() => {
    const map = new Map<string, FieldworkVisitItem>();

    // 1. Map FollowUps
    for (const fu of followUps) {
      const rawDate = fu.visitDate ? (fu.visitDate.includes('T') ? fu.visitDate.split('T')[0] : fu.visitDate) : '';
      const isDueToday = isToday(rawDate);
      const isOverdue = isPastDate(rawDate) && fu.status !== 'completed';

      let computedStatus: 'Due Today' | 'In Progress' | 'Completed' | 'Overdue' = 'Due Today';
      if (fu.status === 'completed') {
        computedStatus = 'Completed';
      } else if (fu.status === 'in_progress') {
        computedStatus = 'In Progress';
      } else if (isOverdue) {
        computedStatus = 'Overdue';
      } else if (isDueToday) {
        computedStatus = 'Due Today';
      }

      const patient = patients.find((p) => p.id === fu.patientId);
      const patientDisplayId = fu.patientDisplayId || patient?.patientId || 'RC-FIELD';
      const patientName = fu.patientName || patient?.fullName || 'Patient';

      map.set(fu.id, {
        id: fu.id,
        type: 'visit',
        followUpId: fu.id,
        patientId: fu.patientId,
        patientDisplayId,
        patientName,
        title: `${fu.category}: ${patientName}`,
        category: fu.category,
        scheduledDate: rawDate,
        scheduledTime: fu.scheduledTime,
        purpose: fu.observations,
        priority: fu.priority || 'medium',
        status: computedStatus,
        rawStatus: fu.status,
        completed: fu.status === 'completed',
        completedAt: fu.completedAt,
        followUpRecord: fu,
      });
    }

    // 2. Map Tasks that aren't already represented by a FollowUp
    for (const t of tasks) {
      if (t.followUpId && map.has(t.followUpId)) {
        continue; // Already mapped through FollowUp
      }

      const rawDate = t.dueDate ? (t.dueDate.includes('T') ? t.dueDate.split('T')[0] : t.dueDate) : '';
      const isDueToday = isToday(rawDate);
      const isOverdue = isPastDate(rawDate) && !t.completed;

      let computedStatus: 'Due Today' | 'In Progress' | 'Completed' | 'Overdue' = 'Due Today';
      if (t.completed) {
        computedStatus = 'Completed';
      } else if (isOverdue) {
        computedStatus = 'Overdue';
      } else if (isDueToday) {
        computedStatus = 'Due Today';
      }

      const patient = patients.find((p) => p.id === t.patientId);
      const patientDisplayId = t.patientDisplayId || patient?.patientId || 'RC-FIELD';
      const patientName = t.patientName || patient?.fullName || 'Patient';

      map.set(t.id, {
        id: t.id,
        type: 'task',
        taskId: t.id,
        patientId: t.patientId,
        patientDisplayId,
        patientName,
        title: t.title,
        category: t.category,
        scheduledDate: rawDate,
        scheduledTime: t.scheduledTime,
        purpose: t.title,
        priority: t.priority,
        status: computedStatus,
        rawStatus: t.completed ? 'completed' : 'scheduled',
        completed: t.completed,
        completedAt: t.completedAt,
      });
    }

    return Array.from(map.values());
  }, [followUps, tasks, patients]);

  // Priority weighting for sorting: urgent=4, high=3, medium=2, low=1
  const priorityWeight = (p: TaskPriority) => {
    switch (p) {
      case 'urgent': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  };

  // Sort: Priority descending, then scheduledTime ascending
  const sortComparator = (a: FieldworkVisitItem, b: FieldworkVisitItem) => {
    const pDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (pDiff !== 0) return pDiff;

    if (a.scheduledTime && b.scheduledTime) {
      return a.scheduledTime.localeCompare(b.scheduledTime);
    }
    if (a.scheduledTime) return -1;
    if (b.scheduledTime) return 1;

    return 0;
  };

  // 1. TODAY'S FIELDWORK: only items scheduled for current local calendar date or overdue
  // Strictly excludes future dates!
  const todaysFieldwork = useMemo(() => {
    return allFieldworkItems
      .filter((item) => item.scheduledDate === todayStr || item.status === 'Overdue')
      .sort(sortComparator);
  }, [allFieldworkItems, todayStr]);

  // 2. UPCOMING VISITS: strictly future dates (scheduledDate > todayStr)
  const upcomingVisits = useMemo(() => {
    return allFieldworkItems
      .filter((item) => isFutureDate(item.scheduledDate))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || sortComparator(a, b));
  }, [allFieldworkItems]);

  // Handle opening modal if triggered via NotificationCenter
  useEffect(() => {
    if (selectedVisitIdForModal) {
      const target = allFieldworkItems.find((item) => item.id === selectedVisitIdForModal);
      if (target) {
        setSelectedVisitItem(target);
        setIsVisitModalOpen(true);
      }
      clearSelectedVisitId();
    }
  }, [selectedVisitIdForModal, allFieldworkItems, clearSelectedVisitId]);

  // Dynamic statistics derived strictly from local records
  const totalPatients = patients.length;
  const dueTodayCount = allFieldworkItems.filter(
    (item) => item.scheduledDate === todayStr && !item.completed
  ).length;
  const overdueCount = allFieldworkItems.filter((item) => item.status === 'Overdue').length;
  const completedVisitsCount = allFieldworkItems.filter((item) => item.status === 'Completed').length;

  // Recently completed visits
  const recentFollowUps = [...followUps]
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
    .slice(0, 5);

  const openVisitModal = (item: FieldworkVisitItem) => {
    setSelectedVisitItem(item);
    setIsVisitModalOpen(true);
  };

  const getPriorityStyle = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-danger text-black border-2 border-black font-black';
      case 'high':
        return 'bg-yellow text-black border-2 border-black font-black';
      case 'medium':
        return 'bg-cream text-black border border-black font-bold';
      default:
        return 'bg-white text-neutral-700 border border-black font-bold';
    }
  };

  const getStatusBadge = (status: FieldworkVisitItem['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="px-2 py-0.5 bg-forest text-white border-2 border-black text-[10px] font-black rounded shadow-brutal-xs flex items-center gap-1">
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Completed</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="px-2 py-0.5 bg-teal text-black border-2 border-black text-[10px] font-black rounded shadow-brutal-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
            <span>In Progress</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="px-2 py-0.5 bg-danger text-black border-2 border-black text-[10px] font-black rounded shadow-brutal-xs">
            Overdue
          </span>
        );
      case 'Due Today':
      default:
        return (
          <span className="px-2 py-0.5 bg-yellow text-black border-2 border-black text-[10px] font-black rounded shadow-brutal-xs">
            Due Today
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 lg:space-y-8">
      {/* 1. Top Greeting & Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
              {greeting}, {workerFirstName}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black bg-yellow border-2 border-black text-black shadow-brutal-xs">
              <MapPin className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span>{villageZone}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black border-2 border-black bg-white text-black shadow-brutal-xs">
              {!isOnline ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-danger border border-black animate-pulse" />
                  <span>Offline Mode</span>
                </>
              ) : pendingSyncCount > 0 ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow border border-black animate-pulse" />
                  <span>{pendingSyncCount} waiting to sync</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-teal border border-black" />
                  <span>All synced</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-700 mt-1.5 font-bold">
            Daily field summary • Scheduled visits, priority follow-ups, and village rounds
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <Link to="/app/emergency">
            <button
              className="px-3.5 py-2 rounded-lg border-2 border-black bg-danger hover:bg-danger-hover text-black font-heading font-black text-xs sm:text-sm shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center gap-2 shrink-0"
              title="Immediate SOS Emergency & Hospital Referral Portal"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-black animate-ping" />
              <span>🚨 SOS EMERGENCY</span>
            </button>
          </Link>
          <BrutalButton 
            variant="primary" 
            size="md" 
            onClick={() => setIsScheduleModalOpen(true)}
            icon={<Plus className="w-4 h-4 text-black stroke-[3]" />}
          >
            Schedule Visit
          </BrutalButton>
          <Link to="/app/patients/new">
            <BrutalButton variant="forest" size="md" icon={<UserPlus className="w-4 h-4 text-white stroke-[2.5]" />}>
              Register Patient
            </BrutalButton>
          </Link>
        </div>
      </div>

      {/* Visible SOS Emergency Entry Point Banner */}
      <div className="p-3.5 sm:p-4 bg-danger/15 border-2 border-black rounded-xl shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-danger border-2 border-black flex items-center justify-center text-black shadow-brutal-xs shrink-0">
            <span className="text-xl">🚨</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-heading font-black text-black">
                SOS Emergency Assistance & Referral System
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-danger text-black border border-black shadow-brutal-xs">
                Active 24x7
              </span>
            </div>
            <p className="text-xs text-neutral-800 font-bold mt-0.5">
              Immediate triage, GPS hospital discovery (5–50 km), 112 direct call, verified ambulance dispatch & printable referral slip
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="tel:112"
            className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-cream text-black text-xs font-black shadow-brutal-xs transition-colors flex items-center gap-1.5"
            title="User-initiated direct call to National Emergency Services (112)"
          >
            <span>📞 Call 112</span>
          </a>
          <Link to="/app/emergency">
            <BrutalButton variant="primary" size="sm" icon={<ArrowRight className="w-4 h-4 stroke-[3]" />}>
              Open SOS Referral Portal
            </BrutalButton>
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Patients Registered */}
        <div className="p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Registered Patients
            </p>
            <div className="w-8 h-8 rounded-lg bg-yellow border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">
              {totalPatients}
            </span>
            <span className="text-xs text-neutral-600 font-bold">In sector</span>
          </div>
        </div>

        {/* Metric 2: Due Today */}
        <div className="p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Due Today
            </p>
            <div className="w-8 h-8 rounded-lg bg-teal border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
              <Calendar className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">
              {dueTodayCount}
            </span>
            <span className="text-xs text-neutral-600 font-bold">{formatDateDisplay(todayStr)}</span>
          </div>
        </div>

        {/* Metric 3: Overdue Visits */}
        <div className="p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Overdue Visits
            </p>
            <div className="w-8 h-8 rounded-lg bg-danger border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
              <AlertCircle className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-heading font-black text-danger">
              {overdueCount}
            </span>
            <span className="text-xs text-danger font-bold">Needs attention</span>
          </div>
        </div>

        {/* Metric 4: Completed Visits */}
        <div className="p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Completed Visits
            </p>
            <div className="w-8 h-8 rounded-lg bg-forest border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">
              {completedVisitsCount}
            </span>
            <span className="text-xs text-neutral-600 font-bold">Logged</span>
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Today's Fieldwork (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b-2 border-black">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-heading font-black text-black">
                  Today's Fieldwork & Follow-up Tasks
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-yellow border border-black text-[11px] font-black">
                  {todaysFieldwork.length}
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-bold mt-0.5">
                Prioritized household visits and scheduled checks for today ({formatDateDisplay(todayStr)})
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="px-2.5 py-1 text-xs font-black rounded border-2 border-black bg-yellow hover:bg-yellow-hover text-black shadow-brutal-xs transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Schedule</span>
              </button>

              <button
                onClick={() => setIsViewAllModalOpen(true)}
                className="text-xs font-black text-black hover:text-neutral-700 underline flex items-center gap-1"
              >
                <span>View all ({allFieldworkItems.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Today's Tasks List */}
          {todaysFieldwork.length === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-black rounded-xl space-y-3 shadow-brutal">
              <div className="w-12 h-12 rounded-full bg-forest border-2 border-black flex items-center justify-center mx-auto shadow-brutal-xs">
                <Check className="w-6 h-6 text-white stroke-[3]" />
              </div>
              <p className="font-black text-base text-black">No fieldwork scheduled for today</p>
              <p className="text-xs font-bold text-neutral-600 max-w-md mx-auto">
                All rounds are up to date. You can schedule a visit for today or review upcoming visits below.
              </p>
              <div className="pt-1">
                <BrutalButton
                  size="sm"
                  variant="primary"
                  onClick={() => setIsScheduleModalOpen(true)}
                  icon={<Plus className="w-3.5 h-3.5 stroke-[3]" />}
                >
                  Schedule a Visit for Today
                </BrutalButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysFieldwork.map((item) => {
                const isOverdue = item.status === 'Overdue';
                const isCompleted = item.completed;
                const isInProgress = item.status === 'In Progress';

                return (
                  <div
                    key={item.id}
                    className={`p-4 bg-white border-2 border-black rounded-xl shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                      isCompleted ? 'opacity-85 bg-cream/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Checkbox toggle */}
                      <button
                        onClick={() => {
                          if (item.taskId && onToggleTask) {
                            onToggleTask(item.taskId);
                          } else {
                            openVisitModal(item);
                          }
                        }}
                        className={`mt-0.5 w-5 h-5 rounded border-2 border-black flex items-center justify-center shrink-0 shadow-brutal-xs transition-colors ${
                          isCompleted ? 'bg-forest text-white' : 'bg-white hover:bg-yellow'
                        }`}
                        title={isCompleted ? 'Completed' : 'Mark complete or conduct visit'}
                      >
                        {isCompleted && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Title & Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`font-black text-sm text-black ${isCompleted ? 'line-through text-neutral-500' : ''}`}>
                            {item.title}
                          </span>
                          {getStatusBadge(item.status)}
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${getPriorityStyle(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>

                        {/* Patient info: Prominently displaying unique Patient ID to eliminate ambiguity */}
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-700 font-bold">
                          <div className="flex items-center gap-1.5">
                            <span className="text-black font-black">
                              {item.patientName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-yellow border border-black text-black">
                              ID: {item.patientDisplayId}
                            </span>
                          </div>

                          <span className="flex items-center gap-1 text-neutral-600">
                            <Clock className="w-3 h-3 text-black" />
                            <span>
                              {item.scheduledTime ? formatTimeDisplay(item.scheduledTime) : 'Today'}
                            </span>
                          </span>

                          <span className="text-neutral-500 text-[11px]">
                            • {item.category}
                          </span>
                        </div>

                        {/* Purpose note if available */}
                        {item.purpose && (
                          <p className="text-xs text-neutral-600 line-clamp-1 italic">
                            "{item.purpose}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Start Visit vs View Visit */}
                    <div className="shrink-0 self-end sm:self-center">
                      {isCompleted ? (
                        <button
                          onClick={() => openVisitModal(item)}
                          className="px-3 py-1.5 text-xs font-black rounded-lg border-2 border-black bg-white hover:bg-cream text-black shadow-brutal-xs transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Visit</span>
                        </button>
                      ) : isInProgress ? (
                        <button
                          onClick={() => openVisitModal(item)}
                          className="px-3 py-1.5 text-xs font-black rounded-lg border-2 border-black bg-teal hover:bg-teal/80 text-black shadow-brutal-xs transition-colors flex items-center gap-1 animate-pulse"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Resume Visit</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openVisitModal(item)}
                          className="px-3 py-1.5 text-xs font-black rounded-lg border-2 border-black bg-yellow hover:bg-yellow-hover text-black shadow-brutal-xs transition-colors flex items-center gap-1"
                        >
                          <span>Start Visit</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* UPCOMING VISITS SECTION (For future scheduled dates) */}
          <div className="pt-4 border-t-2 border-black space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="text-base sm:text-lg font-heading font-black text-black flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>Upcoming Scheduled Visits</span>
                  <span className="px-2 py-0.5 rounded-full bg-cream border border-black text-[10px] font-black">
                    {upcomingVisits.length}
                  </span>
                </h3>
                <p className="text-xs text-neutral-600 font-bold">
                  Planned household rounds scheduled for future calendar days
                </p>
              </div>

              {upcomingVisits.length > 3 && (
                <button
                  onClick={() => {
                    setViewAllFilter('UPCOMING');
                    setIsViewAllModalOpen(true);
                  }}
                  className="text-xs font-black underline text-black hover:text-neutral-700"
                >
                  See all upcoming
                </button>
              )}
            </div>

            {upcomingVisits.length === 0 ? (
              <div className="p-4 bg-cream/70 border-2 border-black rounded-xl text-center text-xs font-bold text-neutral-600">
                No upcoming visits scheduled for future dates. Click "+ Schedule Visit" above to plan a round.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingVisits.slice(0, 4).map((visit) => (
                  <div
                    key={visit.id}
                    className="p-3.5 bg-white border-2 border-black rounded-xl shadow-brutal-xs hover:shadow-brutal transition-all space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cream border border-black text-black">
                          {formatDateDisplay(visit.scheduledDate)}
                          {visit.scheduledTime ? ` • ${formatTimeDisplay(visit.scheduledTime)}` : ''}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase tracking-wider ${getPriorityStyle(visit.priority)}`}>
                          {visit.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="font-black text-xs text-black">
                          {visit.patientName}
                        </span>
                        <span className="px-1 py-0.2 rounded text-[9px] font-black bg-yellow border border-black text-black">
                          {visit.patientDisplayId}
                        </span>
                      </div>

                      <p className="text-[11px] font-bold text-neutral-600 line-clamp-1">
                        {visit.category}
                      </p>
                    </div>

                    <button
                      onClick={() => openVisitModal(visit)}
                      className="w-full mt-2 py-1 px-2 text-[11px] font-black rounded border-2 border-black bg-white hover:bg-yellow text-black shadow-brutal-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span>Inspect Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Household Activity (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black">
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black text-black">
                Recent Household Visits
              </h2>
              <p className="text-xs text-neutral-600 font-bold">
                Latest healthcare logs recorded in your zone
              </p>
            </div>
            <Link to="/app/follow-ups" className="text-xs font-black text-black hover:text-neutral-700 underline flex items-center gap-1">
              <span>View logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentFollowUps.length === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-black rounded-xl space-y-2 shadow-brutal">
              <ClipboardList className="w-8 h-8 text-neutral-400 mx-auto stroke-[2]" />
              <p className="font-black text-sm text-black">No recent visit logs</p>
              <p className="text-xs font-bold text-neutral-600">Recorded patient encounters will appear here.</p>
              <div className="pt-2">
                <Link to="/app/follow-ups">
                  <BrutalButton variant="primary" size="sm">
                    Record First Visit
                  </BrutalButton>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentFollowUps.map((fu) => (
                <div
                  key={fu.id}
                  className="p-3.5 bg-white border-2 border-black rounded-xl shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-black">
                        {fu.patientName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-yellow border border-black text-black">
                        {fu.patientDisplayId}
                      </span>
                    </div>
                    <BrutalBadge syncStatus={fu.syncStatus} size="sm" />
                  </div>

                  <p className="text-neutral-600 font-bold text-[11px]">
                    {fu.category} • {formatDateDisplay(fu.visitDate)}
                  </p>

                  <p className="text-black font-medium text-xs line-clamp-2">
                    {fu.observations}
                  </p>

                  {fu.nextFollowUpDate && (
                    <p className="text-[10px] font-black text-forest flex items-center gap-1 pt-0.5">
                      <Calendar className="w-3 h-3 text-forest" />
                      Next round: {formatDateDisplay(fu.nextFollowUpDate)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VIEW ALL SCHEDULED VISITS MODAL */}
      {isViewAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-white border-3 border-black rounded-2xl shadow-brutal-lg overflow-hidden my-6 transition-all">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-yellow border-b-2 border-black flex items-center justify-between">
              <div>
                <h3 className="text-lg font-heading font-black text-black">
                  All Fieldwork & Scheduled Visits ({allFieldworkItems.length})
                </h3>
                <p className="text-xs font-bold text-neutral-800">
                  Comprehensive roster of past, present, and upcoming patient rounds
                </p>
              </div>

              <button
                onClick={() => setIsViewAllModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black hover:bg-neutral-100 shadow-brutal-xs"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* Filter Pills */}
            <div className="p-3.5 bg-cream border-b-2 border-black flex flex-wrap items-center gap-2">
              {(['ALL', 'TODAY', 'UPCOMING', 'OVERDUE', 'COMPLETED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setViewAllFilter(filter)}
                  className={`px-3 py-1 text-xs font-black rounded-lg border-2 border-black transition-all ${
                    viewAllFilter === filter
                      ? 'bg-yellow text-black shadow-brutal-xs'
                      : 'bg-white text-black hover:bg-neutral-100'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="p-4 sm:p-6 max-h-[500px] overflow-y-auto space-y-2.5">
              {allFieldworkItems
                .filter((item) => {
                  if (viewAllFilter === 'TODAY') return item.scheduledDate === todayStr;
                  if (viewAllFilter === 'UPCOMING') return isFutureDate(item.scheduledDate);
                  if (viewAllFilter === 'OVERDUE') return item.status === 'Overdue';
                  if (viewAllFilter === 'COMPLETED') return item.completed;
                  return true;
                })
                .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || sortComparator(a, b))
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white border-2 border-black rounded-xl shadow-brutal-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-xs text-black">
                          {item.patientName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-yellow border border-black text-black">
                          {item.patientDisplayId}
                        </span>
                        {getStatusBadge(item.status)}
                        <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase ${getPriorityStyle(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 font-bold">
                        {item.category} • Date: {formatDateDisplay(item.scheduledDate)}
                        {item.scheduledTime ? ` at ${formatTimeDisplay(item.scheduledTime)}` : ''}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsViewAllModalOpen(false);
                        openVisitModal(item);
                      }}
                      className="px-3 py-1 text-xs font-black rounded border-2 border-black bg-yellow hover:bg-yellow-hover text-black shadow-brutal-xs"
                    >
                      {item.completed ? 'View' : 'Visit'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* START / CONDUCT VISIT MODAL */}
      <VisitModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        visitItem={selectedVisitItem}
        patients={patients}
      />

      {/* SCHEDULE VISIT MODAL */}
      <ScheduleVisitModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        patients={patients}
      />
    </div>
  );
};

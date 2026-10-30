import React from 'react';
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
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { BrutalCard } from '../components/ui/BrutalCard';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAuth } from '../context/AuthContext';
import { Patient, FollowUp, Task } from '../types';

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

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const workerFirstName = user?.name ? user.name.split(' ')[0] : 'Healthcare Worker';
  const villageZone = user?.villageSector || 'Health Sector';

  const todayStr = new Date().toISOString().split('T')[0];

  // Dynamic statistics derived from local state
  const totalPatients = patients.length;
  
  // Follow-ups due today (either visit scheduled today or nextFollowUpDate is today)
  const dueTodayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr);
  const dueTodayFollowUps = followUps.filter(f => f.nextFollowUpDate === todayStr);
  const followUpsDueTodayCount = dueTodayTasks.length + dueTodayFollowUps.length;

  // Overdue follow-ups & tasks
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate < todayStr);
  const overdueCount = overdueTasks.length;

  // Completed visits
  const completedVisitsCount = followUps.filter(f => f.status === 'completed').length;

  // Today's fieldwork list (combining pending tasks for today/overdue)
  const todaysFieldwork = tasks.filter(t => !t.completed).slice(0, 5);

  // Recently visited patients
  const recentFollowUps = [...followUps]
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
    .slice(0, 5);

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

            {/* Clear, accurate inline connectivity indicator */}
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

        {/* Primary Action Buttons: Yellow and Deep Forest Green with hard offset shadows */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/app/follow-ups">
            <BrutalButton variant="forest" size="md" icon={<ClipboardList className="w-4 h-4 text-white stroke-[2.5]" />}>
              Record Visit
            </BrutalButton>
          </Link>
          <Link to="/app/patients/new">
            <BrutalButton variant="primary" size="md" icon={<UserPlus className="w-4 h-4 text-black stroke-[2.5]" />}>
              Register Patient
            </BrutalButton>
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Row - High-Contrast Neo-Brutalist Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Patients Registered (Yellow accent) */}
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

        {/* Metric 2: Follow-ups Due Today (Mint accent) */}
        <div className="p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Due Today
            </p>
            <div className="w-8 h-8 rounded-lg bg-forest border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
              <Calendar className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">
              {followUpsDueTodayCount}
            </span>
            <span className="text-xs text-neutral-600 font-bold">Scheduled</span>
          </div>
        </div>

        {/* Metric 3: Overdue Follow-ups (Alert Red / Yellow) */}
        <div className={`p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all ${overdueCount > 0 ? 'bg-yellow/15' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Overdue
            </p>
            <div className={`w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center text-black shadow-brutal-xs ${overdueCount > 0 ? 'bg-danger' : 'bg-cream'}`}>
              <AlertCircle className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-3xl sm:text-4xl font-heading font-black ${overdueCount > 0 ? 'text-black' : 'text-neutral-500'}`}>
              {overdueCount}
            </span>
            <span className="text-xs text-neutral-600 font-bold">Action needed</span>
          </div>
        </div>

        {/* Metric 4: Completed Visits (Soft Blue accent) */}
        <div className="p-4 sm:p-5 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600 font-heading">
              Completed Visits
            </p>
            <div className="w-8 h-8 rounded-lg bg-secondary border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-heading font-black text-black">
              {completedVisitsCount}
            </span>
            <span className="text-xs text-neutral-600 font-bold">Recorded logs</span>
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Layout: Today's Fieldwork & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Today's Fieldwork (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black">
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black text-black">
                Today's Fieldwork & Follow-up Tasks
              </h2>
              <p className="text-xs text-neutral-600 font-bold">
                Prioritized household visits and scheduled checks for today
              </p>
            </div>
            <Link to="/app/tasks" className="text-xs font-black text-black hover:text-neutral-700 underline flex items-center gap-1">
              <span>View all ({tasks.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {todaysFieldwork.length === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-black rounded-xl space-y-2 shadow-brutal">
              <div className="w-12 h-12 rounded-full bg-forest border-2 border-black flex items-center justify-center mx-auto shadow-brutal-xs">
                <Check className="w-6 h-6 text-white stroke-[3]" />
              </div>
              <p className="font-black text-base text-black">All fieldwork complete</p>
              <p className="text-xs font-bold text-neutral-600">No pending or overdue field tasks for this shift.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysFieldwork.map((task) => {
                const isOverdue = task.dueDate < todayStr;
                return (
                  <div
                    key={task.id}
                    className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        onClick={() => onToggleTask && onToggleTask(task.id)}
                        className="mt-0.5 w-5 h-5 rounded border-2 border-black bg-white hover:bg-yellow flex items-center justify-center shrink-0 shadow-brutal-xs transition-colors"
                        title="Mark complete"
                      >
                        {task.completed ? <Check className="w-3.5 h-3.5 text-black stroke-[3]" /> : null}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm text-black">
                            {task.title}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-0.5 bg-danger text-black border-2 border-black text-[10px] font-black rounded shadow-brutal-xs">
                              Overdue
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-cream text-black border border-black text-[10px] font-bold rounded">
                            {task.category}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 font-bold">
                          {task.patientName && (
                            <span className="text-black font-black">
                              Patient: {task.patientName}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-neutral-600">
                            <Clock className="w-3 h-3 text-black" />
                            <span>Due: {task.dueDate}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link to={`/app/follow-ups`}>
                      <button className="px-2.5 py-1 text-xs font-black rounded border-2 border-black bg-yellow hover:bg-yellow-hover text-black shadow-brutal-xs transition-colors shrink-0">
                        Visit
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Activity & Quick Follow-ups (5 Cols) */}
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
            <div className="bg-white border-2 border-black rounded-xl shadow-brutal overflow-hidden divide-y-2 divide-black">
              {recentFollowUps.map((fu) => (
                <div key={fu.id} className="p-3.5 hover:bg-cream transition-colors space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-black">
                      {fu.patientName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black border-2 border-black bg-forest text-white shadow-brutal-xs">
                      {fu.category}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-700 font-medium line-clamp-1">
                    {fu.observations || 'Routine wellness assessment completed.'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-black" />
                      <span>{fu.visitDate}</span>
                    </span>
                    <span className="text-black font-black">
                      ID: {fu.patientDisplayId || 'RC-PATIENT'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Info Box: Neo-Brutalist Callout */}
          <div className="p-4 bg-yellow border-2 border-black rounded-xl shadow-brutal space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-black" />
              <h3 className="font-heading font-black text-sm text-black uppercase tracking-wider">
                Field Tip: Offline-First Operation
              </h3>
            </div>
            <p className="text-xs font-bold text-black leading-relaxed">
              When visiting remote villages without cellular connectivity, RuralCare Connect operates completely offline. All registrations, vitals, and visit notes are safely preserved and will automatically synchronize when connection is restored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

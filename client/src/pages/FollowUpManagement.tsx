import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { BrutalCard } from '../components/ui/BrutalCard';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalInput } from '../components/ui/BrutalInput';
import { BrutalSelect } from '../components/ui/BrutalSelect';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { 
  ClipboardCheck, 
  Calendar, 
  Check, 
  User, 
  ArrowLeft,
  Clock,
  AlertCircle,
  Eye,
  Plus,
  Play
} from 'lucide-react';
import { Patient, FollowUp, FollowUpCategory, FollowUpStatus, TaskPriority, FieldworkVisitItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { getLocalDateString, formatDateDisplay, formatTimeDisplay } from '../utils/dateUtils';
import { VisitModal } from '../components/VisitModal';
import { dbService } from '../services/db';

interface FollowUpManagementProps {
  patients: Patient[];
  followUps: FollowUp[];
  onAddFollowUp: (followUp: FollowUp) => Promise<void> | void;
}

export const FollowUpManagement: React.FC<FollowUpManagementProps> = ({
  patients,
  followUps,
  onAddFollowUp,
}) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedPatientId = searchParams.get('patientId') || '';

  const [mode, setMode] = useState<'SCHEDULE' | 'LOG_COMPLETED'>('SCHEDULE');
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId);
  const [visitDate, setVisitDate] = useState(() => getLocalDateString());
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [category, setCategory] = useState<FollowUpCategory>('General check-up');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<FollowUpStatus>('scheduled');
  const [observations, setObservations] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal inspection state
  const [inspectingVisit, setInspectingVisit] = useState<FieldworkVisitItem | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'SCHEDULED' | 'COMPLETED'>('ALL');

  useEffect(() => {
    if (preselectedPatientId && !selectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  useEffect(() => {
    if (mode === 'SCHEDULE') {
      setStatus('scheduled');
    } else {
      setStatus('completed');
    }
  }, [mode]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const categories: FollowUpCategory[] = [
    'General check-up',
    'Maternal health follow-up',
    'Child wellness follow-up',
    'Medication adherence check',
    'Routine follow-up',
  ];

  const priorities: { label: string; value: TaskPriority }[] = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedPatientId) newErrors.patient = 'Please select a patient';
    if (!visitDate) newErrors.visitDate = 'Date is required';
    if (!observations.trim()) {
      newErrors.observations = mode === 'SCHEDULE' 
        ? 'Please enter visit purpose or instructions' 
        : 'Please enter field visit observations';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      if (mode === 'SCHEDULE') {
        await dbService.scheduleVisit({
          patientId: selectedPatientId,
          patientDisplayId: selectedPatient ? selectedPatient.patientId : 'RC-FIELD',
          patientName: selectedPatient ? selectedPatient.fullName : 'Unknown Patient',
          visitDate,
          scheduledTime: scheduledTime ? scheduledTime.trim() : undefined,
          category,
          observations: observations.trim(),
          notes: notes.trim(),
          priority,
          chwName: user?.name || 'Sarah Jenkins',
        });
      } else {
        const newFollowUp: FollowUp = {
          id: uuidv4(),
          patientId: selectedPatientId,
          patientDisplayId: selectedPatient ? selectedPatient.patientId : 'RC-FIELD',
          patientName: selectedPatient ? selectedPatient.fullName : 'Unknown Patient',
          visitDate,
          scheduledTime: scheduledTime ? scheduledTime.trim() : undefined,
          category,
          observations: observations.trim(),
          notes: notes.trim(),
          nextFollowUpDate: nextFollowUpDate || undefined,
          status,
          priority,
          completedAt: new Date().toISOString(),
          chwName: user?.name || 'Sarah Jenkins',
          syncStatus: 'pending',
          version: 1,
          lastModified: new Date().toISOString(),
        };
        await onAddFollowUp(newFollowUp);
      }

      setSaveSuccess(true);
      setObservations('');
      setNotes('');
      setNextFollowUpDate('');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save follow-up:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenVisit = (fu: FollowUp) => {
    setInspectingVisit({
      id: fu.id,
      type: 'visit',
      followUpId: fu.id,
      patientId: fu.patientId,
      patientDisplayId: fu.patientDisplayId,
      patientName: fu.patientName,
      title: `${fu.category}: ${fu.patientName}`,
      category: fu.category,
      scheduledDate: fu.visitDate,
      scheduledTime: fu.scheduledTime,
      purpose: fu.observations,
      priority: fu.priority || 'medium',
      status: fu.status === 'completed' ? 'Completed' : fu.status === 'in_progress' ? 'In Progress' : 'Due Today',
      rawStatus: fu.status,
      completed: fu.status === 'completed',
      completedAt: fu.completedAt,
      followUpRecord: fu,
    });
    setIsVisitModalOpen(true);
  };

  const filteredLogs = followUps.filter((fu) => {
    if (logFilter === 'SCHEDULED') return fu.status === 'scheduled' || fu.status === 'in_progress';
    if (logFilter === 'COMPLETED') return fu.status === 'completed';
    return true;
  });

  return (
    <div className="w-full space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
            Fieldwork & Follow-up Scheduling
          </h1>
          <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
            Schedule upcoming patient rounds, log conducted visits, and track household care
          </p>
        </div>

        <Link to="/app/patients" className="text-xs font-black underline text-black hover:text-neutral-700">
          View Patients Registry →
        </Link>
      </div>

      {/* 2. Success Banner */}
      {saveSuccess && (
        <div className="p-3.5 bg-forest border-2 border-black rounded-xl text-white text-sm font-black flex items-center gap-2.5 shadow-brutal-xs">
          <Check className="w-4 h-4 text-white stroke-[3]" />
          <span>
            {mode === 'SCHEDULE' 
              ? 'Visit scheduled successfully and saved to this device.' 
              : 'Completed visit record saved to this device. It will synchronize automatically.'}
          </span>
        </div>
      )}

      {/* 3. Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Main Form (8 Cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-5 bg-white p-6 sm:p-8 border-2 border-black rounded-xl shadow-brutal">
          {/* Mode Switcher: Schedule vs Log Completed */}
          <div className="p-1.5 bg-cream border-2 border-black rounded-xl flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('SCHEDULE')}
              className={`flex-1 py-2 px-3 text-xs font-black rounded-lg transition-all ${
                mode === 'SCHEDULE'
                  ? 'bg-yellow text-black border-2 border-black shadow-brutal-xs'
                  : 'bg-transparent text-neutral-700 hover:text-black'
              }`}
            >
              📅 Schedule Upcoming Visit
            </button>
            <button
              type="button"
              onClick={() => setMode('LOG_COMPLETED')}
              className={`flex-1 py-2 px-3 text-xs font-black rounded-lg transition-all ${
                mode === 'LOG_COMPLETED'
                  ? 'bg-forest text-white border-2 border-black shadow-brutal-xs'
                  : 'bg-transparent text-neutral-700 hover:text-black'
              }`}
            >
              ✓ Log Completed Visit
            </button>
          </div>

          {/* Patient Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Select Patient <span className="text-danger">*</span>
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className={`brutal-input text-sm cursor-pointer ${errors.patient ? '!border-danger' : ''}`}
            >
              <option value="">-- Choose a registered patient (Name & ID) --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientId}) — {p.village}
                </option>
              ))}
            </select>
            {errors.patient && (
              <p className="text-xs text-danger font-black mt-1">{errors.patient}</p>
            )}
            {patients.length === 0 && (
              <p className="text-xs text-neutral-600 font-bold mt-1">
                No patients registered yet. <Link to="/app/patients/new" className="underline font-black text-black">Register a patient first</Link>.
              </p>
            )}
          </div>

          {/* Category Quick Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Visit Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`
                    text-xs font-black px-3 py-1.5 rounded-lg transition-all
                    ${
                      category === cat
                        ? 'bg-yellow text-black border-2 border-black shadow-brutal-xs'
                        : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                {mode === 'SCHEDULE' ? 'Scheduled Date (Local)' : 'Visit Date'} <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="brutal-input text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                Scheduled Time (Optional)
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="brutal-input text-sm"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`py-1 px-2 text-xs font-black rounded-lg border-2 border-black text-center transition-all ${
                    priority === p.value
                      ? 'bg-yellow text-black shadow-brutal-xs font-black'
                      : 'bg-white text-neutral-600 hover:bg-cream'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose / Observations */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              {mode === 'SCHEDULE' ? 'Visit Purpose / Instructions' : 'Visit Observations'} <span className="text-danger">*</span>
            </label>
            <textarea
              className={`brutal-input min-h-[90px] text-sm resize-y ${errors.observations ? '!border-danger' : ''}`}
              placeholder={
                mode === 'SCHEDULE'
                  ? 'e.g. Check routine adherence, verify blood pressure, and inspect nutrition packet delivery...'
                  : 'e.g. Patient feeling well. Checked routine adherence and gave dietary guidance...'
              }
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
            {errors.observations ? (
              <p className="text-xs text-danger font-black mt-1">{errors.observations}</p>
            ) : (
              <p className="text-[11px] text-neutral-600 font-bold mt-1">
                {mode === 'SCHEDULE'
                  ? 'Clarifies why this visit is scheduled and what actions the CHW should take.'
                  : 'Record vital signs, observations, and general patient notes.'}
              </p>
            )}
          </div>

          {/* Additional Notes & Next Follow-up (if logging completed) */}
          {mode === 'LOG_COMPLETED' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                  Action Taken / Outcome Notes
                </label>
                <input
                  type="text"
                  className="brutal-input text-sm"
                  placeholder="e.g. Bring iron supplement packet next time"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                  Next Follow-up Due Date
                </label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="brutal-input text-sm"
                />
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-3 border-t-2 border-black flex items-center justify-between">
            <span className="text-xs text-neutral-600 font-bold">
              Persisted instantly on device (offline-first).
            </span>

            <BrutalButton
              type="submit"
              variant={mode === 'SCHEDULE' ? 'primary' : 'forest'}
              size="lg"
              disabled={isSubmitting}
              icon={mode === 'SCHEDULE' ? <Calendar className="w-4 h-4 stroke-[2.5]" /> : <ClipboardCheck className="w-4 h-4 stroke-[2.5]" />}
            >
              {isSubmitting 
                ? 'Saving...' 
                : mode === 'SCHEDULE' 
                  ? 'Schedule Field Visit' 
                  : 'Save Completed Visit'}
            </BrutalButton>
          </div>
        </form>

        {/* Right Column: Visit Feed (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="pb-2 border-b-2 border-black flex items-center justify-between">
            <div>
              <h3 className="text-sm font-heading font-black text-black uppercase tracking-wider">
                Visit Roster ({followUps.length})
              </h3>
              <p className="text-xs text-neutral-600 font-bold">Stored on this device</p>
            </div>

            <div className="flex items-center gap-1">
              {(['ALL', 'SCHEDULED', 'COMPLETED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2 py-0.5 text-[10px] font-black rounded border border-black ${
                    logFilter === filter ? 'bg-yellow text-black' : 'bg-white text-neutral-600'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="text-xs text-neutral-600 font-bold py-6 text-center bg-white border-2 border-black rounded-xl shadow-brutal">
              No visits found for filter.
            </p>
          ) : (
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredLogs.map((fu) => {
                const isCompleted = fu.status === 'completed';
                const isInProgress = fu.status === 'in_progress';
                return (
                  <div
                    key={fu.id}
                    className="p-3.5 bg-white border-2 border-black rounded-xl text-xs space-y-2 shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-black">{fu.patientName}</span>
                        <span className="px-1 py-0.2 rounded text-[9px] font-black bg-yellow border border-black text-black">
                          {fu.patientDisplayId}
                        </span>
                      </div>
                      <BrutalBadge syncStatus={fu.syncStatus} size="sm" />
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[11px] text-neutral-600 font-bold">
                      <span>{fu.category} • {formatDateDisplay(fu.visitDate)}</span>
                      {fu.scheduledTime && <span>{formatTimeDisplay(fu.scheduledTime)}</span>}
                    </div>

                    <p className="text-black font-medium line-clamp-2">
                      {fu.observations}
                    </p>

                    <div className="pt-1 flex items-center justify-between border-t border-black/10">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
                        isCompleted ? 'bg-forest text-white' : isInProgress ? 'bg-teal text-black' : 'bg-yellow text-black'
                      }`}>
                        {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Scheduled'}
                      </span>

                      <button
                        onClick={() => handleOpenVisit(fu)}
                        className="px-2 py-0.5 text-xs font-black rounded border border-black bg-white hover:bg-yellow text-black shadow-brutal-xs flex items-center gap-1"
                      >
                        {isCompleted ? <Eye className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isCompleted ? 'View' : isInProgress ? 'Resume' : 'Start Visit'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Visit Modal */}
      <VisitModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        visitItem={inspectingVisit}
        patients={patients}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  Plus, 
  Check 
} from 'lucide-react';
import { BrutalButton } from './ui/BrutalButton';
import { Patient, FollowUpCategory, TaskPriority, FollowUp } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { dbService } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface ScheduleVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  initialPatientId?: string;
  onVisitScheduled?: (followUp: FollowUp) => void;
}

export const ScheduleVisitModal: React.FC<ScheduleVisitModalProps> = ({
  isOpen,
  onClose,
  patients,
  initialPatientId,
  onVisitScheduled,
}) => {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [visitDate, setVisitDate] = useState(() => getLocalDateString());
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [category, setCategory] = useState<FollowUpCategory>('General check-up');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories: FollowUpCategory[] = [
    'General check-up',
    'Maternal health follow-up',
    'Child wellness follow-up',
    'Medication adherence check',
    'Routine follow-up',
  ];

  const priorities: { label: string; value: TaskPriority; color: string }[] = [
    { label: 'Low', value: 'low', color: 'bg-white' },
    { label: 'Medium', value: 'medium', color: 'bg-cream' },
    { label: 'High', value: 'high', color: 'bg-yellow' },
    { label: 'Urgent', value: 'urgent', color: 'bg-danger' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setError('Please select a registered patient.');
      return;
    }
    if (!visitDate) {
      setError('Please select a scheduled visit date.');
      return;
    }
    if (!purpose.trim()) {
      setError('Please enter the purpose or instructions for this visit.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const selectedPatient = patients.find((p) => p.id === patientId);

    try {
      const res = await dbService.scheduleVisit({
        patientId,
        patientDisplayId: selectedPatient?.patientId || 'RC-FIELD',
        patientName: selectedPatient?.fullName || 'Patient',
        visitDate,
        scheduledTime: scheduledTime ? scheduledTime.trim() : undefined,
        category,
        observations: purpose.trim(),
        priority,
        chwName: user?.name || 'Sarah Jenkins',
      });

      if (onVisitScheduled) {
        onVisitScheduled(res.followUp);
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to schedule visit:', err);
      setError(err.message || 'Failed to schedule visit in database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white border-3 border-black rounded-2xl shadow-brutal-lg overflow-hidden my-6 transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-yellow border-b-2 border-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black text-black">
                Schedule Field Visit
              </h2>
              <p className="text-xs font-bold text-neutral-800">
                Plan a routine check, follow-up, or household round
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black hover:bg-neutral-100 shadow-brutal-xs transition-colors shrink-0"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger/10 border-2 border-danger rounded-xl text-xs font-black text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Patient */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Select Patient <span className="text-danger">*</span>
            </label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="brutal-input text-xs sm:text-sm cursor-pointer"
            >
              <option value="">-- Choose a patient by name or ID --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientId}) — {p.village}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Visit Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 border-black transition-all ${
                    category === cat
                      ? 'bg-yellow text-black shadow-brutal-xs'
                      : 'bg-white text-black hover:bg-cream'
                  }`}
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
                Scheduled Date (Local) <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="brutal-input text-xs sm:text-sm"
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
                className="brutal-input text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Priority Level
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`py-1.5 px-2 text-xs font-black rounded-lg border-2 border-black text-center transition-all ${
                    priority === p.value
                      ? `${p.color} text-black shadow-brutal-xs font-black`
                      : 'bg-white text-neutral-600 hover:bg-cream'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose / Instructions */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Purpose / Instructions for Visit <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Check routine blood pressure, review iron supplementation adherence, and inspect infant wellness..."
              className="brutal-input text-xs sm:text-sm resize-y"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t-2 border-black flex items-center justify-between gap-3">
            <span className="text-[11px] text-neutral-600 font-bold">
              Persisted instantly on device.
            </span>

            <div className="flex items-center gap-2">
              <BrutalButton
                type="button"
                variant="white"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </BrutalButton>

              <BrutalButton
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                icon={<Plus className="w-4 h-4 stroke-[3]" />}
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule Visit'}
              </BrutalButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

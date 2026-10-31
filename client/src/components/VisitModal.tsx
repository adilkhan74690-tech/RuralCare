import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Calendar, 
  Save, 
  CheckCircle,
  FileText,
  User,
  Activity
} from 'lucide-react';
import { BrutalButton } from './ui/BrutalButton';
import { BrutalBadge } from './ui/BrutalBadge';
import { Patient, FollowUp, Task, TaskPriority, FollowUpCategory } from '../types';
import { formatDateDisplay, formatTimeDisplay, formatFullLocalDate } from '../utils/dateUtils';
import { dbService } from '../services/db';

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitItem: {
    id: string; // followUp.id or task.id
    patientId?: string;
    patientDisplayId?: string;
    patientName?: string;
    title?: string;
    category?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    purpose?: string;
    priority?: TaskPriority;
    completed?: boolean;
    completedAt?: string;
    status?: string;
    followUpRecord?: FollowUp;
  } | null;
  patients: Patient[];
  onVisitCompleted?: (updated: FollowUp) => void;
}

export const VisitModal: React.FC<VisitModalProps> = ({
  isOpen,
  onClose,
  visitItem,
  patients,
  onVisitCompleted,
}) => {
  if (!isOpen || !visitItem) return null;

  const isAlreadyCompleted = visitItem.completed || visitItem.status === 'Completed' || visitItem.followUpRecord?.status === 'completed';

  // Find target patient
  const targetPatient = patients.find(
    (p) => p.id === visitItem.patientId || p.patientId === visitItem.patientDisplayId
  );

  const patientDisplayId = visitItem.patientDisplayId || targetPatient?.patientId || 'RC-FIELD';
  const patientName = visitItem.patientName || targetPatient?.fullName || 'Patient';

  // Sanitize purpose: treat 'NA' / 'N/A' as not specified
  const rawPurpose = (visitItem.purpose || '').trim();
  const cleanPurpose = (!rawPurpose || rawPurpose.toUpperCase() === 'NA' || rawPurpose.toUpperCase() === 'N/A')
    ? ''
    : rawPurpose;

  // Never prefill observations or notes with 'NA' or 'N/A'
  const getCleanText = (val?: string) => {
    if (!val) return '';
    const trimmed = val.trim();
    return (trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'N/A') ? '' : trimmed;
  };

  const [observations, setObservations] = useState(
    getCleanText(visitItem.followUpRecord?.observations)
  );
  const [notes, setNotes] = useState(
    getCleanText(visitItem.followUpRecord?.notes)
  );
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    visitItem.followUpRecord?.nextFollowUpDate || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Transition to In Progress when opened for an incomplete visit
  useEffect(() => {
    if (!isAlreadyCompleted && visitItem.id) {
      dbService.startVisit(visitItem.id).catch(() => {
        // Ignore if it was a task ID without followUp yet
      });
    }
  }, [visitItem.id, isAlreadyCompleted]);

  // Prepopulate if visitItem changes, ensuring 'NA' is stripped
  useEffect(() => {
    if (visitItem.followUpRecord) {
      setObservations(getCleanText(visitItem.followUpRecord.observations));
      setNotes(getCleanText(visitItem.followUpRecord.notes));
      setNextFollowUpDate(visitItem.followUpRecord.nextFollowUpDate || '');
    } else {
      setObservations('');
      setNotes('');
      setNextFollowUpDate('');
    }
    setError(null);
    setSaveSuccess(false);
  }, [visitItem]);

  const handleCompleteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedObs = observations.trim();
    if (!trimmedObs || trimmedObs.toUpperCase() === 'NA' || trimmedObs.toUpperCase() === 'N/A') {
      setError('Please record detailed visit observations and clinical findings before completing.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cleanObs = trimmedObs;
      const cleanNotes = getCleanText(notes);

      const updated = await dbService.completeVisit(visitItem.id, {
        observations: cleanObs,
        notes: cleanNotes,
        nextFollowUpDate: nextFollowUpDate || undefined,
      });

      setSaveSuccess(true);
      if (onVisitCompleted) {
        onVisitCompleted(updated);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to complete visit:', err);
      setError(err.message || 'An error occurred while saving the visit.');
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const cleanObs = getCleanText(observations);
      const cleanNotes = getCleanText(notes);

      await dbService.saveVisitProgress(visitItem.id, {
        observations: cleanObs,
        notes: cleanNotes,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Draft save failed:', err);
    }
  };

  const priorityBadgeVariant = () => {
    switch (visitItem.priority) {
      case 'urgent':
        return 'bg-danger text-black border-2 border-black';
      case 'high':
        return 'bg-yellow text-black border-2 border-black';
      case 'medium':
        return 'bg-cream text-black border border-black';
      default:
        return 'bg-white text-neutral-700 border border-black';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-2xl bg-white border-3 border-black rounded-2xl shadow-brutal-lg overflow-hidden my-6 transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-yellow border-b-2 border-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black text-black">
                {isAlreadyCompleted ? 'Completed Household Visit' : 'Conduct Field Visit'}
              </h2>
              <p className="text-xs font-bold text-neutral-800">
                {isAlreadyCompleted 
                  ? 'Historical visit log & recorded outcome' 
                  : 'Live field encounter • Auto-saved to device'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAlreadyCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black bg-forest border-2 border-black text-white shadow-brutal-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Completed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black bg-teal border-2 border-black text-black shadow-brutal-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-black" />
                <span>In Progress</span>
              </span>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black hover:bg-neutral-100 shadow-brutal-xs transition-colors shrink-0"
              title="Close"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Patient Identity Card - Critical for distinguishing patients with identical names */}
        <div className="p-4 sm:p-5 bg-cream border-b-2 border-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/20">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base sm:text-lg font-heading font-black text-black">
                  {patientName}
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-yellow border-2 border-black text-black shadow-brutal-xs tracking-wider">
                  ID: {patientDisplayId}
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-bold mt-0.5 flex flex-wrap items-center gap-2">
                {targetPatient && (
                  <span>
                    {targetPatient.age} yrs • {targetPatient.gender}
                  </span>
                )}
                {targetPatient?.village && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-black" />
                    {targetPatient.village}
                  </span>
                )}
                {targetPatient?.contactNumber && (
                  <span>• Tel: {targetPatient.contactNumber}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider shadow-brutal-xs ${priorityBadgeVariant()}`}>
                {visitItem.priority || 'medium'} priority
              </span>
              <span className="px-2 py-0.5 rounded bg-white text-black border-2 border-black text-[11px] font-black shadow-brutal-xs">
                {visitItem.category || 'General Follow-up'}
              </span>
            </div>
          </div>

          {/* Scheduled Purpose / Instructions */}
          <div className="mt-3 text-xs font-medium text-neutral-800 flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-black shrink-0 mt-0.5 stroke-[2.5]" />
            <div>
              <span className="font-black text-black">Scheduled for: </span>
              <span className="font-bold">
                {formatFullLocalDate(visitItem.scheduledDate || '')}
                {visitItem.scheduledTime && ` at ${formatTimeDisplay(visitItem.scheduledTime)}`}
              </span>
              <p className="mt-1 text-xs text-neutral-700 font-bold">
                <span className="font-black text-black">Visit Purpose: </span>
                {cleanPurpose ? (
                  <span>{cleanPurpose}</span>
                ) : (
                  <span className="italic text-neutral-500 font-medium">Not specified</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCompleteVisit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger/10 border-2 border-danger rounded-xl text-xs font-black text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-forest text-white border-2 border-black rounded-xl text-xs font-black flex items-center gap-2 shadow-brutal-xs">
              <Check className="w-4 h-4 text-white stroke-[3]" />
              <span>Visit successfully recorded and persisted to device!</span>
            </div>
          )}

          {/* Observations */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Field Observations & Patient Status <span className="text-danger">*</span>
            </label>
            <textarea
              rows={4}
              disabled={isAlreadyCompleted}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Record observations, general wellness, medication adherence, symptoms, or household notes..."
              className={`brutal-input text-xs sm:text-sm resize-y min-h-[90px] ${
                isAlreadyCompleted ? 'bg-neutral-100 cursor-not-allowed opacity-90' : ''
              }`}
            />
            <p className="text-[11px] text-neutral-600 font-bold mt-1">
              {isAlreadyCompleted 
                ? 'Recorded by Community Health Worker during field visit.' 
                : 'Vital observations, routine checks, and basic adherence guidance.'}
            </p>
          </div>

          {/* Outcome & Next Follow-Up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                Outcome / Action Notes
              </label>
              <input
                type="text"
                disabled={isAlreadyCompleted}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Meds refilled; dietary advice given"
                className={`brutal-input text-xs sm:text-sm ${
                  isAlreadyCompleted ? 'bg-neutral-100 cursor-not-allowed opacity-90' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                Next Follow-Up Date (Optional)
              </label>
              <input
                type="date"
                disabled={isAlreadyCompleted}
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className={`brutal-input text-xs sm:text-sm ${
                  isAlreadyCompleted ? 'bg-neutral-100 cursor-not-allowed opacity-90' : ''
                }`}
              />
            </div>
          </div>

          {/* Completed Info if View Mode */}
          {isAlreadyCompleted && (
            <div className="p-3 bg-white border-2 border-black rounded-xl text-xs font-bold text-neutral-700 flex flex-wrap items-center justify-between gap-2 shadow-brutal-xs">
              <span className="flex items-center gap-1.5 text-forest font-black">
                <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                Completed on device
              </span>
              <span>
                {visitItem.completedAt ? new Date(visitItem.completedAt).toLocaleString() : 'Marked Complete'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t-2 border-black flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-neutral-600 font-bold">
              {isAlreadyCompleted ? 'Read-only visit record' : 'Saved locally on device (offline-first).'}
            </span>

            <div className="flex items-center gap-2">
              {!isAlreadyCompleted && (
                <BrutalButton
                  type="button"
                  variant="white"
                  size="sm"
                  onClick={handleSaveDraft}
                  icon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Draft
                </BrutalButton>
              )}

              {isAlreadyCompleted ? (
                <BrutalButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onClose}
                >
                  Close Record
                </BrutalButton>
              ) : (
                <BrutalButton
                  type="submit"
                  variant="forest"
                  size="md"
                  disabled={isSubmitting}
                  icon={<Check className="w-4 h-4 text-white stroke-[3]" />}
                >
                  {isSubmitting ? 'Saving...' : 'Complete Visit'}
                </BrutalButton>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

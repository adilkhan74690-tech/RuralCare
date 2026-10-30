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
  ArrowLeft 
} from 'lucide-react';
import { Patient, FollowUp, FollowUpCategory, FollowUpStatus } from '../types';

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedPatientId = searchParams.get('patientId') || '';

  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<FollowUpCategory>('General check-up');
  const [status, setStatus] = useState<FollowUpStatus>('completed');
  const [observations, setObservations] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (preselectedPatientId && !selectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const categories: FollowUpCategory[] = [
    'General check-up',
    'Maternal health follow-up',
    'Child wellness follow-up',
    'Medication adherence check',
    'Routine follow-up',
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedPatientId) newErrors.patient = 'Please select a patient';
    if (!visitDate) newErrors.visitDate = 'Visit date is required';
    if (!observations.trim()) newErrors.observations = 'Please enter field visit observations';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const newFollowUp: FollowUp = {
      id: uuidv4(),
      patientId: selectedPatientId,
      patientDisplayId: selectedPatient ? selectedPatient.patientId : 'RC-FIELD',
      patientName: selectedPatient ? selectedPatient.fullName : 'Unknown Patient',
      visitDate,
      category,
      observations: observations.trim(),
      notes: notes.trim(),
      nextFollowUpDate: nextFollowUpDate || undefined,
      status,
      chwName: 'Sarah Jenkins',
      syncStatus: 'pending',
      version: 1,
      lastModified: new Date().toISOString(),
    };

    try {
      await onAddFollowUp(newFollowUp);
      setSaveSuccess(true);
      // Reset form
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

  return (
    <div className="w-full space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
            Record Follow-up Visit
          </h1>
          <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
            Log visit details, vital observations, and schedule upcoming rounds
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
          <span>Visit record saved to this device. It will automatically synchronize when you are online.</span>
        </div>
      )}

      {/* 3. Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Main Form (8 Cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-5 bg-white p-6 sm:p-8 border-2 border-black rounded-xl shadow-brutal">
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
              <option value="">-- Choose a registered patient --</option>
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

          {/* Visit Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                Visit Date <span className="text-danger">*</span>
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
                Visit Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                className="brutal-input text-sm cursor-pointer"
              >
                <option value="completed">Completed (Home visit conducted)</option>
                <option value="scheduled">Scheduled (Planned visit)</option>
                <option value="missed">Missed (Patient unavailable)</option>
              </select>
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
              Visit Observations <span className="text-danger">*</span>
            </label>
            <textarea
              className={`brutal-input min-h-[90px] text-sm resize-y ${errors.observations ? '!border-danger' : ''}`}
              placeholder="e.g. Patient feeling well. Checked routine adherence and gave dietary guidance."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
            {errors.observations ? (
              <p className="text-xs text-danger font-black mt-1">{errors.observations}</p>
            ) : (
              <p className="text-[11px] text-neutral-600 font-bold mt-1">
                Record basic observations and general follow-up notes.
              </p>
            )}
          </div>

          {/* Additional Notes & Next Follow-up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
                Notes for Next Visit (Optional)
              </label>
              <input
                type="text"
                className="brutal-input text-sm"
                placeholder="e.g. Bring iron supplement packet"
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

          {/* Submit Actions */}
          <div className="pt-3 border-t-2 border-black flex items-center justify-between">
            <span className="text-xs text-neutral-600 font-bold">
              Persisted instantly on device.
            </span>

            <BrutalButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              icon={<ClipboardCheck className="w-4 h-4 stroke-[2.5]" />}
            >
              {isSubmitting ? 'Saving...' : 'Save Visit Record'}
            </BrutalButton>
          </div>
        </form>

        {/* Right Column: Recent Visit Feed (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="pb-2 border-b-2 border-black">
            <h3 className="text-sm font-heading font-black text-black uppercase tracking-wider">
              Recent Logs ({followUps.length})
            </h3>
            <p className="text-xs text-neutral-600 font-bold">Stored on this device</p>
          </div>

          {followUps.length === 0 ? (
            <p className="text-xs text-neutral-600 font-bold py-6 text-center bg-white border-2 border-black rounded-xl shadow-brutal">
              No visits logged yet.
            </p>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {followUps.slice(0, 6).map((fu) => (
                <div
                  key={fu.id}
                  className="p-3.5 bg-white border-2 border-black rounded-xl text-xs space-y-1.5 shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-black">{fu.patientName}</span>
                    <BrutalBadge syncStatus={fu.syncStatus} size="sm" />
                  </div>
                  <p className="text-neutral-600 font-bold text-[11px]">
                    {fu.category} • {fu.visitDate}
                  </p>
                  <p className="text-black font-medium line-clamp-2">
                    {fu.observations}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

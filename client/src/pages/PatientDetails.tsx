import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Calendar, 
  Plus, 
  ClipboardList
} from 'lucide-react';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { Patient, FollowUp } from '../types';
import { getLocalDateString } from '../utils/dateUtils';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';

interface PatientDetailsProps {
  patients: Patient[];
  followUps: FollowUp[];
  onUpdatePatient?: (patient: Patient) => void;
}

export const PatientDetails: React.FC<PatientDetailsProps> = ({
  patients,
  followUps,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Look up in passed props first, fall back to live IndexedDB query
  const patientFromProp = patients.find((p) => p.id === id || p.patientId === id);
  const livePatient = useLiveQuery(
    () => (id ? db.patients.where('id').equals(id).or('patientId').equals(id).first() : undefined),
    [id]
  );
  const patient = patientFromProp || livePatient;

  const liveFollowUps = useLiveQuery(
    () => (id ? db.followUps.where('patientId').equals(id).or('patientDisplayId').equals(id).toArray() : []),
    [id]
  );
  const allFollowUps = followUps.length > 0 ? followUps : (liveFollowUps || []);

  const patientFollowUps = allFollowUps
    .filter((f) => f.patientId === id || f.patientDisplayId === patient?.patientId || f.patientId === patient?.id)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

  // Upcoming follow-up (earliest upcoming date)
  const todayStr = getLocalDateString();
  const upcomingFollowUp = patientFollowUps.find(
    (f) => f.nextFollowUpDate && f.nextFollowUpDate >= todayStr
  );

  if (!patient) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-black text-black">Patient Record Not Found</h2>
        <p className="text-neutral-600 text-sm font-bold">
          No record found for this patient on this device.
        </p>
        <Link to="/app/patients">
          <BrutalButton variant="primary" size="sm">
            Back to Patients
          </BrutalButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 lg:space-y-8">
      {/* 1. Back Navigation & Quick Actions */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-black">
        <button
          onClick={() => navigate('/app/patients')}
          className="inline-flex items-center gap-2 text-xs font-black text-black hover:underline"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Back to Patients Registry</span>
        </button>

        <div className="flex items-center gap-2">
          <Link to={`/app/emergency?patientId=${patient.id}`}>
            <button
              className="px-3 py-1.5 rounded-lg border-2 border-black bg-danger hover:bg-danger-hover text-black text-xs font-black shadow-brutal-xs flex items-center gap-1.5 transition-colors"
              title="Initiate Emergency Assistance for this patient"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>🚨 SOS Emergency</span>
            </button>
          </Link>
          <Link to={`/app/follow-ups?patientId=${patient.id}`}>
            <BrutalButton variant="primary" size="sm" icon={<Plus className="w-4 h-4 stroke-[2.5]" />}>
              Record Visit
            </BrutalButton>
          </Link>
        </div>
      </div>

      {/* 2. Patient Identity Header */}
      <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-black">
                {patient.fullName}
              </h1>
              <span className="font-mono text-xs font-black text-black bg-yellow px-3 py-1 rounded-md border-2 border-black shadow-brutal-xs">
                {patient.patientId}
              </span>
              <BrutalBadge syncStatus={patient.syncStatus} size="sm" />
            </div>

            <p className="text-sm text-neutral-700 font-bold mt-1">
              {patient.age} years old • {patient.gender} • Registered {new Date(patient.registrationDate).toLocaleDateString()}
            </p>
          </div>

          <div className="text-left sm:text-right text-xs text-neutral-700 font-bold space-y-1">
            <p>Assigned Worker: <strong className="text-black font-black">{patient.chwAssigned}</strong></p>
            <p>Sector: <span className="text-black font-black">{patient.village}</span></p>
          </div>
        </div>

        {/* Highlighted Next Follow-up Banner */}
        {upcomingFollowUp && (
          <div className="p-3.5 bg-forest text-white border-2 border-black rounded-lg flex items-center justify-between text-xs shadow-brutal-xs">
            <div className="flex items-center gap-2 text-white font-bold">
              <Calendar className="w-4 h-4 text-white stroke-[2.5]" />
              <span>
                Next follow-up due: <strong className="text-yellow font-black">{upcomingFollowUp.nextFollowUpDate}</strong>
              </span>
            </div>
            <Link
              to={`/app/follow-ups?patientId=${patient.id}`}
              className="font-black underline text-yellow hover:text-white"
            >
              Prepare visit →
            </Link>
          </div>
        )}
      </div>

      {/* 3. Basic Information & Household Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 text-sm">
          <h3 className="font-heading font-black text-xs uppercase tracking-wider text-neutral-600">
            Household Details
          </h3>
          
          <div className="space-y-3">
            <div>
              <span className="text-neutral-500 text-xs block font-bold">Village / Hamlet</span>
              <span className="font-black text-black flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-4 h-4 text-black stroke-[2.5]" />
                {patient.village}
              </span>
            </div>

            <div>
              <span className="text-neutral-500 text-xs block font-bold">Contact Phone</span>
              <span className="font-black text-black flex items-center gap-1.5 mt-0.5">
                <Phone className="w-4 h-4 text-black stroke-[2.5]" />
                {patient.contactNumber}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 p-5 bg-white border-2 border-black rounded-xl shadow-brutal space-y-2 text-sm">
          <h3 className="font-heading font-black text-xs uppercase tracking-wider text-neutral-600">
            Administrative Field Notes
          </h3>
          <p className="text-black font-bold leading-relaxed text-sm">
            {patient.notes ? patient.notes : 'No specific field notes recorded for this patient.'}
          </p>
        </div>
      </div>

      {/* 4. Visit Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b-2 border-black">
          <div>
            <h2 className="text-base sm:text-lg font-heading font-black text-black">
              Visit Timeline ({patientFollowUps.length})
            </h2>
            <p className="text-xs text-neutral-600 font-bold">
              Chronological log of community health worker visits
            </p>
          </div>

          <Link to={`/app/follow-ups?patientId=${patient.id}`}>
            <BrutalButton variant="white" size="sm" icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}>
              Add Visit Log
            </BrutalButton>
          </Link>
        </div>

        {patientFollowUps.length === 0 ? (
          <div className="p-8 text-center bg-white border-2 border-black rounded-xl space-y-2 shadow-brutal">
            <ClipboardList className="w-8 h-8 text-neutral-400 mx-auto stroke-[2]" />
            <p className="font-black text-sm text-black">No visits logged yet</p>
            <p className="text-xs text-neutral-600 font-bold">
              Record check-ups, maternal health updates, or routine wellness checks.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patientFollowUps.map((fu) => (
              <div
                key={fu.id}
                className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-md transition-all space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-black font-heading">
                      {fu.category}
                    </span>
                    <span className="text-xs text-neutral-600 font-bold">
                      • {fu.visitDate}
                    </span>
                  </div>
                  <BrutalBadge syncStatus={fu.syncStatus} size="sm" />
                </div>

                <div className="text-sm text-black font-bold">
                  {fu.observations}
                </div>

                {fu.notes && (
                  <p className="text-xs text-neutral-800 bg-cream p-3 rounded-lg border-2 border-black font-bold">
                    <strong className="text-black">Worker Note:</strong> {fu.notes}
                  </p>
                )}

                {fu.nextFollowUpDate && (
                  <div className="pt-2 text-xs text-neutral-700 flex flex-wrap items-center justify-between gap-1 border-t-2 border-black font-bold">
                    <span>
                      Next scheduled follow-up: <strong className="text-black font-black">{fu.nextFollowUpDate}</strong>
                    </span>
                    <span>Logged by: {fu.chwName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

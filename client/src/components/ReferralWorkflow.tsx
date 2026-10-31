import React, { useState } from 'react';
import { 
  Building2, 
  PhoneCall, 
  Truck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  FileText,
  UserCheck,
  Phone
} from 'lucide-react';
import { EmergencyIncident, HealthcareFacility, ContactAttempt, ReferralStatus } from '../types';
import { BrutalButton } from './ui/BrutalButton';
import { BrutalInput } from './ui/BrutalInput';
import { BrutalSelect } from './ui/BrutalSelect';

interface ReferralWorkflowProps {
  incident: EmergencyIncident;
  selectedFacility: HealthcareFacility | null;
  onUpdateIncident: (updates: Partial<EmergencyIncident>) => Promise<void>;
  onOpenReferralSlip: () => void;
}

export const ReferralWorkflow: React.FC<ReferralWorkflowProps> = ({
  incident,
  selectedFacility,
  onUpdateIncident,
  onOpenReferralSlip,
}) => {
  // Contact attempt state
  const [recipient, setRecipient] = useState('Emergency Medical Officer');
  const [contactPhone, setContactPhone] = useState(selectedFacility?.phone || '');
  const [outcome, setOutcome] = useState('Reached - Bed Confirmed');
  const [contactNotes, setContactNotes] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Transport state
  const [transportType, setTransportType] = useState(incident.transportType || '108 Emergency Medical Ambulance');
  const [transportContact, setTransportContact] = useState(incident.transportContact || '');
  const [transportNotes, setTransportNotes] = useState(incident.transportNotes || '');
  const [dispatchConfirmed, setDispatchConfirmed] = useState(Boolean(incident.dispatchConfirmed));
  const [isSavingTransport, setIsSavingTransport] = useState(false);

  // Arrival / Handover state
  const [handoverTo, setHandoverTo] = useState(incident.handoverTo || '');
  const [handoverNotes, setHandoverNotes] = useState(incident.handoverNotes || '');
  const [isSavingArrival, setIsSavingArrival] = useState(false);

  // Add Contact Attempt
  const handleAddContactAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) return;

    setIsAddingContact(true);
    try {
      const newAttempt: ContactAttempt = {
        id: `ca-${Date.now()}`,
        timestamp: new Date().toISOString(),
        recipient: recipient.trim(),
        phone: contactPhone.trim(),
        outcome,
        notes: contactNotes.trim(),
      };

      const existingAttempts = incident.contactAttempts || [];
      const updatedAttempts = [...existingAttempts, newAttempt];

      await onUpdateIncident({
        contactAttempts: updatedAttempts,
        referralStatus: incident.referralStatus === 'initiated' ? 'facility_selected' : incident.referralStatus,
      });

      setContactNotes('');
    } finally {
      setIsAddingContact(false);
    }
  };

  // Save Transport Arrangement
  const handleSaveTransport = async () => {
    setIsSavingTransport(true);
    try {
      await onUpdateIncident({
        transportType,
        transportContact: transportContact.trim(),
        transportNotes: transportNotes.trim(),
        dispatchConfirmed,
        referralStatus: dispatchConfirmed ? 'transport_arranged' : incident.referralStatus,
      });
    } finally {
      setIsSavingTransport(false);
    }
  };

  // Mark Arrival & Handover
  const handleMarkArrival = async () => {
    setIsSavingArrival(true);
    try {
      const now = new Date().toISOString();
      await onUpdateIncident({
        arrivedAt: now,
        handoverTo: handoverTo.trim() || 'Casualty Duty In-Charge',
        handoverNotes: handoverNotes.trim(),
        referralStatus: 'arrived',
      });
    } finally {
      setIsSavingArrival(false);
    }
  };

  // Complete Referral
  const handleCompleteReferral = async () => {
    await onUpdateIncident({
      referralStatus: 'completed',
    });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Step Tracker */}
      <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-heading font-black text-black">
            Emergency Referral Progress Tracker
          </h3>
          <span className="px-2.5 py-0.5 rounded border border-black bg-yellow text-xs font-black uppercase">
            Status: {incident.referralStatus.replace('_', ' ')}
          </span>
        </div>

        {/* Visual Progress Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {/* Step 1: Destination */}
          <div
            className={`p-2 rounded-lg border-2 border-black text-center ${
              incident.facilityName
                ? 'bg-teal text-white font-black shadow-brutal-xs'
                : 'bg-cream text-neutral-600 font-bold'
            }`}
          >
            <p className="text-[10px] uppercase">Step 1</p>
            <p className="text-xs">Hospital Chosen</p>
          </div>

          {/* Step 2: Contact Log */}
          <div
            className={`p-2 rounded-lg border-2 border-black text-center ${
              incident.contactAttempts && incident.contactAttempts.length > 0
                ? 'bg-teal text-white font-black shadow-brutal-xs'
                : 'bg-cream text-neutral-600 font-bold'
            }`}
          >
            <p className="text-[10px] uppercase">Step 2</p>
            <p className="text-xs">Contact Logged</p>
          </div>

          {/* Step 3: Transport */}
          <div
            className={`p-2 rounded-lg border-2 border-black text-center ${
              incident.dispatchConfirmed
                ? 'bg-teal text-white font-black shadow-brutal-xs'
                : incident.transportType
                ? 'bg-yellow text-black font-black shadow-brutal-xs'
                : 'bg-cream text-neutral-600 font-bold'
            }`}
          >
            <p className="text-[10px] uppercase">Step 3</p>
            <p className="text-xs">Transport Coordinated</p>
          </div>

          {/* Step 4: Arrived */}
          <div
            className={`p-2 rounded-lg border-2 border-black text-center ${
              incident.referralStatus === 'arrived' || incident.referralStatus === 'completed'
                ? 'bg-forest text-white font-black shadow-brutal-xs'
                : 'bg-cream text-neutral-600 font-bold'
            }`}
          >
            <p className="text-[10px] uppercase">Step 4</p>
            <p className="text-xs">Facility Arrival</p>
          </div>
        </div>
      </div>

      {/* 1. Destination Hospital Confirmation */}
      <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-heading font-black text-black flex items-center gap-2">
            <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
            <span>Target Destination Hospital</span>
          </h4>
          <span className="text-xs text-neutral-600 font-bold">
            {incident.facilityName ? 'Confirmed' : 'Select from discovery list below'}
          </span>
        </div>

        {incident.facilityName ? (
          <div className="p-3 bg-cream border-2 border-black rounded-lg space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-base font-heading font-black text-black">
                {incident.facilityName}
              </span>
              <span className="text-xs font-black text-teal">
                {incident.facilityDistanceKm != null ? `${incident.facilityDistanceKm} km away` : ''}
              </span>
            </div>
            <p className="text-xs text-neutral-700 font-bold">
              📍 {incident.facilityAddress || 'Address on record'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {incident.facilityPhone && (
                <a
                  href={`tel:${incident.facilityPhone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow border-2 border-black rounded-md text-xs font-black shadow-brutal-xs hover:bg-yellow-hover"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Emergency Desk ({incident.facilityPhone})</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-danger font-black p-2 bg-danger/10 border border-black rounded">
            ⚠️ Please select a destination hospital from the map or discovery list below.
          </p>
        )}
      </div>

      {/* 2. Record Hospital Contact Attempts */}
      <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
        <h4 className="text-sm font-heading font-black text-black flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-black stroke-[2.5]" />
          <span>Record Hospital Contact Attempts & Bed Confirmation</span>
        </h4>

        {/* Existing Attempts History */}
        {incident.contactAttempts && incident.contactAttempts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-neutral-600">Logged Contact History:</p>
            {incident.contactAttempts.map((attempt, idx) => (
              <div
                key={attempt.id || idx}
                className="p-2.5 bg-cream border-2 border-black rounded-lg text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-black">
                    {attempt.recipient} {attempt.phone ? `(${attempt.phone})` : ''}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-600">
                    {new Date(attempt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
                      attempt.outcome.includes('Confirmed')
                        ? 'bg-teal text-white'
                        : 'bg-yellow text-black'
                    }`}
                  >
                    {attempt.outcome}
                  </span>
                  {attempt.notes && <span className="text-neutral-700 font-bold">{attempt.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Contact Attempt Form */}
        <form onSubmit={handleAddContactAttempt} className="space-y-3 pt-2 border-t border-black/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                Recipient / Designation
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Emergency Medical Officer / Dr. Sinha"
                className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                Call Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
              >
                <option value="Reached - Bed Confirmed">Reached - Bed Confirmed Available</option>
                <option value="Reached - Diverted to District Hospital">Reached - Diverted to Higher Center</option>
                <option value="No Answer / Ringing">No Answer / Line Ringing</option>
                <option value="Line Busy">Line Busy / Network Failure</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
              Coordination Notes / Hospital Guidance
            </label>
            <input
              type="text"
              value={contactNotes}
              onChange={(e) => setContactNotes(e.target.value)}
              placeholder="e.g. Duty doctor briefed on patient condition, OT team on standby"
              className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAddingContact}
              className="px-3 py-1.5 bg-yellow hover:bg-yellow-hover text-black border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Log Contact Attempt</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Transport Arrangements & STRICT Dispatch Confirmation */}
      <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-heading font-black text-black flex items-center gap-2">
            <Truck className="w-4 h-4 text-black stroke-[2.5]" />
            <span>Emergency Transport Arrangements</span>
          </h4>
          <span className="text-xs font-black text-neutral-600">
            {dispatchConfirmed ? (
              <span className="text-teal font-black flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dispatch Confirmed</span>
              </span>
            ) : (
              <span className="text-danger font-black flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dispatch Unconfirmed</span>
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
              Transport Type
            </label>
            <select
              value={transportType}
              onChange={(e) => setTransportType(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
            >
              <option value="108 Emergency Medical Ambulance">108 Emergency Ambulance (Dial 108)</option>
              <option value="102 Janani Shishu Suraksha Karyakram (JSSK)">102 Free Maternal Ambulance (JSSK)</option>
              <option value="PHC / CHC Sector Ambulance">PHC / CHC Sector Ambulance</option>
              <option value="Private Ambulance Service">Private Ambulance Service</option>
              <option value="Auto Rickshaw / Local Commercial Van">Auto Rickshaw / Local Commercial Van</option>
              <option value="Family / Personal Private Vehicle">Family / Personal Private Vehicle</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
              Driver / Transport Contact Info
            </label>
            <input
              type="text"
              value={transportContact}
              onChange={(e) => setTransportContact(e.target.value)}
              placeholder="e.g. Driver Ramesh (+91 98765 00108)"
              className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
              Transport Logistics Notes
            </label>
            <input
              type="text"
              value={transportNotes}
              onChange={(e) => setTransportNotes(e.target.value)}
              placeholder="e.g. ETA 15 minutes, patient accompanied by ASHA worker and brother"
              className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
            />
          </div>
        </div>

        {/* STRICT PROTOCOL DISCLAIMER & CONFIRMATION CHECKBOX */}
        <div className="p-3 bg-cream border-2 border-black rounded-lg space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dispatchConfirmed}
              onChange={(e) => setDispatchConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-2 border-black accent-teal cursor-pointer"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-black text-black">
                Authorized Provider Dispatch Confirmed
              </span>
              <p className="text-[11px] text-neutral-600 font-bold">
                Check this ONLY after speaking directly with the 108/102 dispatch control room operator or ambulance driver who has formally confirmed vehicle movement.
              </p>
            </div>
          </label>

          {!dispatchConfirmed && (
            <p className="text-[11px] text-danger font-black pl-6">
              ⚠️ Strict Protocol Notice: RuralCare Connect never claims or records ambulance dispatch without verified provider confirmation.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveTransport}
            disabled={isSavingTransport}
            className="px-4 py-2 bg-yellow hover:bg-yellow-hover text-black border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs transition-colors"
          >
            {isSavingTransport ? 'Saving...' : 'Save Transport Arrangements'}
          </button>
        </div>
      </div>

      {/* 4. Patient Arrival & Handover Tracking */}
      <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
        <h4 className="text-sm font-heading font-black text-black flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-black stroke-[2.5]" />
          <span>Patient Arrival & Clinical Handover Tracking</span>
        </h4>

        {incident.arrivedAt ? (
          <div className="p-3 bg-teal/10 border-2 border-teal rounded-lg space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-teal">
                ✓ Patient Arrived at Facility
              </span>
              <span className="font-mono text-neutral-600 font-bold">
                {new Date(incident.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="font-bold text-black">
              Handed over to: <strong>{incident.handoverTo || 'Duty Medical Officer'}</strong>
            </p>
            {incident.handoverNotes && (
              <p className="text-neutral-700">Notes: {incident.handoverNotes}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Handed Over To (Doctor / Triage Sister)
                </label>
                <input
                  type="text"
                  value={handoverTo}
                  onChange={(e) => setHandoverTo(e.target.value)}
                  placeholder="e.g. Dr. Alok Sinha (Casualty MO)"
                  className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Handover Condition Notes
                </label>
                <input
                  type="text"
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="e.g. Vitals stable, shifted to Emergency Observation Ward"
                  className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleMarkArrival}
                disabled={isSavingArrival}
                className="px-4 py-2 bg-teal hover:bg-teal-hover text-white border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs transition-colors"
              >
                {isSavingArrival ? 'Marking...' : 'Mark Patient Arrived at Facility'}
              </button>
            </div>
          </div>
        )}

        {/* Complete Referral & Printable Slip Row */}
        <div className="pt-3 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-3">
          <BrutalButton
            variant="primary"
            size="md"
            onClick={onOpenReferralSlip}
            icon={<FileText className="w-4 h-4 text-black stroke-[2.5]" />}
          >
            Generate Printable Referral Slip ({incident.referralCode || 'Ready'})
          </BrutalButton>

          {incident.referralStatus !== 'completed' && (
            <button
              type="button"
              onClick={handleCompleteReferral}
              className="px-4 py-2 bg-forest text-white border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs hover:bg-forest-hover transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Referral Case</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { Printer, X, Download, ShieldCheck, AlertTriangle } from 'lucide-react';
import { EmergencyIncident } from '../types';
import { formatDateDisplay } from '../utils/dateUtils';
import { BrutalButton } from './ui/BrutalButton';

interface ReferralSlipModalProps {
  incident: EmergencyIncident;
  onClose: () => void;
}

export const ReferralSlipModal: React.FC<ReferralSlipModalProps> = ({ incident, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const referralCode = incident.referralCode || `REF-2026-${incident.id.slice(0, 6).toUpperCase()}`;
  const incidentDate = incident.incidentTimestamp
    ? new Date(incident.incidentTimestamp).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-3xl bg-white border-2 border-black rounded-xl shadow-brutal-xl overflow-hidden my-6">
        {/* Top Modal Bar (Excluded from print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-yellow border-b-2 border-black">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-black stroke-[2.5]" />
            <h2 className="text-base sm:text-lg font-heading font-black text-black">
              Official Emergency Referral Slip
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <BrutalButton
              variant="forest"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4 text-white stroke-[2.5]" />}
            >
              Print / Save PDF
            </BrutalButton>
            <button
              onClick={onClose}
              className="p-1 rounded-md border-2 border-black bg-white hover:bg-danger text-black shadow-brutal-xs"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="p-6 sm:p-8 space-y-6 referral-slip-printable bg-white">
          {/* Header */}
          <div className="text-center pb-4 border-b-2 border-black space-y-1">
            <div className="inline-block px-3 py-1 bg-yellow border-2 border-black rounded-md text-xs font-black uppercase tracking-wider mb-1">
              Ministry of Health & Family Welfare • National Health Mission (ASHA)
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
              RURALCARE CONNECT EMERGENCY REFERRAL SLIP
            </h1>
            <p className="text-xs text-neutral-700 font-bold">
              Immediate Patient Triage & Inter-Facility Transfer Record
            </p>
          </div>

          {/* Reference Banner & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-cream border-2 border-black rounded-lg">
            <div>
              <p className="text-[11px] font-black uppercase text-neutral-600">Referral Reference No.</p>
              <p className="text-base font-mono font-black text-black">{referralCode}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-neutral-600">Incident Code</p>
              <p className="text-base font-mono font-black text-teal">{incident.incidentCode}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-neutral-600">Referral Priority</p>
              <span className="inline-block px-2.5 py-0.5 text-xs font-black uppercase rounded border border-black bg-danger text-black">
                {incident.priority}
              </span>
            </div>
          </div>

          {/* Patient Information & Worker Information Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patient Info */}
            <div className="p-4 border-2 border-black rounded-lg bg-white space-y-2">
              <h3 className="text-xs font-heading font-black uppercase tracking-wider text-black border-b border-black pb-1">
                1. Patient Particulars
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Full Name:</span>
                  <span className="font-black text-black">{incident.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Registration Status:</span>
                  <span className="font-bold">
                    {incident.isUnregistered ? (
                      <span className="text-danger font-black">Unregistered Emergency</span>
                    ) : (
                      <span className="text-teal font-black">Registered ({incident.patientDisplayId || 'Active'})</span>
                    )}
                  </span>
                </div>
                {incident.unregisteredPatientAge && (
                  <div className="flex justify-between">
                    <span className="font-bold text-neutral-600">Age / Gender:</span>
                    <span className="font-bold">
                      {incident.unregisteredPatientAge} yrs • {incident.unregisteredGender || 'N/A'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Village / Locality:</span>
                  <span className="font-bold">{incident.village || incident.manualAddress || 'Not specified'}</span>
                </div>
                {incident.landmark && (
                  <div className="flex justify-between">
                    <span className="font-bold text-neutral-600">Landmark:</span>
                    <span className="font-bold">{incident.landmark}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ASHA Worker Info */}
            <div className="p-4 border-2 border-black rounded-lg bg-white space-y-2">
              <h3 className="text-xs font-heading font-black uppercase tracking-wider text-black border-b border-black pb-1">
                2. Referring Healthcare Worker
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Worker Name:</span>
                  <span className="font-black text-black">{incident.ashaWorkerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Designation:</span>
                  <span className="font-bold">Accredited Social Health Activist (ASHA)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Timestamp:</span>
                  <span className="font-bold">{incidentDate}</span>
                </div>
                {incident.patientLatitude && incident.patientLongitude && (
                  <div className="flex justify-between">
                    <span className="font-bold text-neutral-600">GPS Origin:</span>
                    <span className="font-mono text-[11px] font-bold">
                      {incident.patientLatitude.toFixed(4)}, {incident.patientLongitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Reason for Referral */}
          <div className="p-4 border-2 border-black rounded-lg bg-white space-y-2">
            <h3 className="text-xs font-heading font-black uppercase tracking-wider text-black border-b border-black pb-1">
              3. Clinical Reason for Emergency Referral
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-neutral-600">Emergency Category: </span>
                <span className="font-black text-black text-sm">{incident.category}</span>
              </div>
              {incident.chiefComplaints && (
                <div>
                  <span className="font-bold text-neutral-600">Chief Complaints: </span>
                  <p className="font-bold text-black mt-0.5">{incident.chiefComplaints}</p>
                </div>
              )}
              {incident.notes && (
                <div>
                  <span className="font-bold text-neutral-600">Fieldworker Observations & First Aid Provided: </span>
                  <p className="font-medium text-neutral-800 mt-0.5 p-2 bg-cream rounded border border-black/20">
                    {incident.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Destination Referral Facility */}
          <div className="p-4 border-2 border-black rounded-lg bg-white space-y-2">
            <h3 className="text-xs font-heading font-black uppercase tracking-wider text-black border-b border-black pb-1">
              4. Destination Facility & Hospital Coordination
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-neutral-600">Target Hospital:</span>
                <span className="font-black text-sm text-black">{incident.facilityName || 'Pending selection'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-neutral-600">Facility Type:</span>
                <span className="font-bold">{incident.facilityType || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-neutral-600">Facility Address:</span>
                <span className="font-bold">{incident.facilityAddress || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-neutral-600">Hospital Emergency Phone:</span>
                <span className="font-bold font-mono">{incident.facilityPhone || 'N/A'}</span>
              </div>
              {incident.facilityDistanceKm != null && (
                <div className="flex justify-between">
                  <span className="font-bold text-neutral-600">Estimated Distance:</span>
                  <span className="font-bold">{incident.facilityDistanceKm} km</span>
                </div>
              )}
            </div>

            {/* Contact Attempts Log if available */}
            {incident.contactAttempts && incident.contactAttempts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-black/15">
                <p className="font-black text-[11px] text-neutral-700 uppercase mb-1">
                  Telephonic Contact & Bed Confirmation Log:
                </p>
                <div className="space-y-1">
                  {incident.contactAttempts.map((ca, idx) => (
                    <div key={idx} className="p-1.5 bg-cream border border-black/20 rounded text-[11px] flex justify-between">
                      <span className="font-bold">
                        {ca.recipient}: <strong className="text-teal">{ca.outcome}</strong>
                      </span>
                      <span className="text-neutral-500 font-mono">
                        {new Date(ca.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Transport & Dispatch Record */}
          <div className="p-4 border-2 border-black rounded-lg bg-white space-y-2">
            <h3 className="text-xs font-heading font-black uppercase tracking-wider text-black border-b border-black pb-1">
              5. Transport & Logistics Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-bold text-neutral-600">Transport Method: </span>
                <span className="font-black text-black">{incident.transportType || 'Self / Private Arrangement'}</span>
              </div>
              <div>
                <span className="font-bold text-neutral-600">Dispatch Status: </span>
                {incident.dispatchConfirmed ? (
                  <span className="font-black text-forest">✓ Operator / Driver Confirmed</span>
                ) : (
                  <span className="font-bold text-neutral-600">Requested / In Coordination</span>
                )}
              </div>
              {incident.transportContact && (
                <div className="sm:col-span-2">
                  <span className="font-bold text-neutral-600">Driver / Contact Person: </span>
                  <span className="font-bold">{incident.transportContact}</span>
                </div>
              )}
              {incident.transportNotes && (
                <div className="sm:col-span-2">
                  <span className="font-bold text-neutral-600">Logistics Notes: </span>
                  <span className="font-medium text-neutral-700">{incident.transportNotes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Handover & Official Signatures Section */}
          <div className="pt-4 border-t-2 border-black">
            <p className="text-[11px] font-black uppercase text-neutral-600 mb-6">
              6. Formal Handover & Receiving Acknowledgment
            </p>
            <div className="grid grid-cols-2 gap-8 text-xs">
              {/* Referring ASHA Signature */}
              <div className="border-t-2 border-black pt-2 space-y-1">
                <p className="font-black text-black">Referring ASHA Worker Signature</p>
                <p className="text-neutral-600">Name: {incident.ashaWorkerName}</p>
                <p className="text-neutral-600">Date: {new Date().toLocaleDateString()}</p>
              </div>

              {/* Receiving Medical Officer Signature */}
              <div className="border-t-2 border-black pt-2 space-y-1">
                <p className="font-black text-black">Receiving Medical Officer / Casualty In-Charge</p>
                <p className="text-neutral-600">Doctor / Staff Nurse Name: _______________________</p>
                <p className="text-neutral-600">Medical Reg. No. / Hospital Seal: __________________</p>
                <p className="text-neutral-600">Arrival Time: __________________</p>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center pt-4 border-t border-black/20 text-[10px] text-neutral-500 font-bold">
            RuralCare Connect Telemedicine & Emergency Referral Architecture • Generated {new Date().toISOString()} • Valid for immediate triage transfer
          </div>
        </div>

        {/* Modal Actions (Excluded from print) */}
        <div className="no-print p-4 bg-cream border-t-2 border-black flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs hover:bg-neutral-100"
          >
            Close
          </button>
          <div className="flex gap-3">
            <BrutalButton
              variant="primary"
              size="md"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4 stroke-[2.5]" />}
            >
              Print Referral Slip
            </BrutalButton>
          </div>
        </div>
      </div>
    </div>
  );
};


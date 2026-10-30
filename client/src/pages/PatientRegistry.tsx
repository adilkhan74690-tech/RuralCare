import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  UserPlus, 
  MapPin, 
  Calendar,
  ChevronRight,
  Filter
} from 'lucide-react';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { Patient, FollowUp } from '../types';

interface PatientRegistryProps {
  patients: Patient[];
  followUps?: FollowUp[];
}

export const PatientRegistry: React.FC<PatientRegistryProps> = ({ 
  patients,
  followUps = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('ALL');

  // Extract distinct villages
  const villages = useMemo(() => {
    return Array.from(new Set(patients.map((p) => p.village))).filter(Boolean);
  }, [patients]);

  // Create a quick lookup for latest visit & next follow-up date per patient
  const patientVisitInfo = useMemo(() => {
    const map: Record<string, { lastVisit?: string; nextFollowUp?: string }> = {};
    followUps.forEach((fu) => {
      const current = map[fu.patientId] || {};
      if (!current.lastVisit || new Date(fu.visitDate) > new Date(current.lastVisit)) {
        current.lastVisit = fu.visitDate;
      }
      if (fu.nextFollowUpDate) {
        if (!current.nextFollowUp || new Date(fu.nextFollowUpDate) > new Date(current.nextFollowUp)) {
          current.nextFollowUp = fu.nextFollowUpDate;
        }
      }
      map[fu.patientId] = current;
    });
    return map;
  }, [followUps]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch =
        patient.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesVillage =
        selectedVillage === 'ALL' || patient.village === selectedVillage;

      return matchesSearch && matchesVillage;
    });
  }, [patients, searchQuery, selectedVillage]);

  return (
    <div className="w-full space-y-6">
      {/* 1. Header & Register Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
            Patients Registry
          </h1>
          <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
            Registered village members, demographic records, and scheduled follow-ups
          </p>
        </div>

        <Link to="/app/patients/new">
          <BrutalButton variant="primary" size="md" icon={<UserPlus className="w-4 h-4 stroke-[2.5]" />}>
            Register Patient
          </BrutalButton>
        </Link>
      </div>

      {/* 2. Search & Village Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by name or ID (e.g. Kamla or RC-2026-001)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="brutal-input pl-9 text-sm"
          />
        </div>

        {/* Village Dropdown */}
        <div className="w-full sm:w-56 shrink-0">
          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="brutal-input text-sm cursor-pointer"
          >
            <option value="ALL">All Villages ({patients.length})</option>
            {villages.map((v) => (
              <option key={v} value={v}>
                Village: {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Empty State or Patients List */}
      {filteredPatients.length === 0 ? (
        <div className="p-12 text-center bg-white border-2 border-black rounded-xl space-y-3 shadow-brutal">
          <p className="font-black text-base text-black">No patients found</p>
          <p className="text-xs text-neutral-600 font-bold max-w-sm mx-auto">
            No patient matches your search or selected village filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedVillage('ALL');
            }}
            className="text-xs font-black underline text-black pt-1"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block bg-white border-2 border-black rounded-xl shadow-brutal overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-cream text-xs font-heading font-black uppercase tracking-wider text-black">
                  <th className="py-3.5 px-4 font-black">Patient Name</th>
                  <th className="py-3.5 px-4 font-black">Age / Gender</th>
                  <th className="py-3.5 px-4 font-black">Village</th>
                  <th className="py-3.5 px-4 font-black">Last Visit</th>
                  <th className="py-3.5 px-4 font-black">Next Follow-up</th>
                  <th className="py-3.5 px-4 font-black">Sync Status</th>
                  <th className="py-3.5 px-4 text-right font-black">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {filteredPatients.map((patient) => {
                  const visitData = patientVisitInfo[patient.id] || {};
                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-yellow/15 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/app/patients/${patient.id}`}
                          className="font-black text-black hover:underline block"
                        >
                          {patient.fullName}
                        </Link>
                        <span className="text-xs text-neutral-600 font-mono font-bold">
                          {patient.patientId}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-black font-bold">
                        {patient.age} yrs • {patient.gender}
                      </td>

                      <td className="py-3.5 px-4 text-black font-bold">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                          <span>{patient.village}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-neutral-700 font-bold">
                        {visitData.lastVisit ? visitData.lastVisit : 'None logged'}
                      </td>

                      <td className="py-3.5 px-4">
                        {visitData.nextFollowUp ? (
                          <span className="font-black text-black">
                            {visitData.nextFollowUp}
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-xs font-bold">Not scheduled</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <BrutalBadge syncStatus={patient.syncStatus} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/app/patients/${patient.id}`}
                          className="inline-flex items-center text-xs font-black px-3 py-1 rounded-md border-2 border-black bg-white hover:bg-yellow text-black transition-all shadow-brutal-xs"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View (Shown on screens < 768px) */}
          <div className="md:hidden space-y-3">
            {filteredPatients.map((patient) => {
              const visitData = patientVisitInfo[patient.id] || {};
              return (
                <Link
                  key={patient.id}
                  to={`/app/patients/${patient.id}`}
                  className="block p-4 bg-white border-2 border-black rounded-xl hover:translate-x-[-1px] hover:translate-y-[-1px] shadow-brutal-sm hover:shadow-brutal transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-base text-black">
                        {patient.fullName}
                      </h3>
                      <p className="text-xs text-neutral-600 font-mono font-bold">
                        {patient.patientId} • {patient.age} yrs, {patient.gender}
                      </p>
                    </div>
                    <BrutalBadge syncStatus={patient.syncStatus} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-black font-bold pt-2 border-t-2 border-black">
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-black">
                        Village
                      </span>
                      <span>{patient.village}</span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-black">
                        Next Due
                      </span>
                      <span>
                        {visitData.nextFollowUp || 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Clean Count Summary */}
          <div className="pt-2 text-xs text-neutral-700 font-bold flex items-center justify-between">
            <span>Showing {filteredPatients.length} of {patients.length} patients</span>
            <span>All records saved locally on device</span>
          </div>
        </>
      )}
    </div>
  );
};

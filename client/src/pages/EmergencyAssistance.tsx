import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  AlertTriangle, 
  PhoneCall, 
  MapPin, 
  Navigation, 
  UserCheck, 
  Building2, 
  Check, 
  Plus, 
  FileText, 
  ShieldAlert, 
  Clock, 
  RefreshCw, 
  ArrowRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { db, dbService } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { 
  Patient, 
  EmergencyIncident, 
  HealthcareFacility, 
  EmergencyPriority, 
  ReferralStatus 
} from '../types';
import { VERIFIED_HEALTHCARE_FACILITIES } from '../data/verifiedFacilities';
import { EmergencyMap } from '../components/EmergencyMap';
import { HospitalDiscovery } from '../components/HospitalDiscovery';
import { ReferralWorkflow } from '../components/ReferralWorkflow';
import { ReferralSlipModal } from '../components/ReferralSlipModal';
import { BrutalCard } from '../components/ui/BrutalCard';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalInput } from '../components/ui/BrutalInput';
import { BrutalSelect } from '../components/ui/BrutalSelect';
import { formatCoordinates } from '../utils/geoUtils';

interface EmergencyAssistanceProps {
  initialIncidentId?: string | null;
}

export const EmergencyAssistance: React.FC<EmergencyAssistanceProps> = ({ initialIncidentId }) => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [searchParams] = useSearchParams();
  const qPatientId = searchParams.get('patientId');
  const qIncidentId = searchParams.get('incidentId');

  // Reactive IndexedDB queries
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const incidents = useLiveQuery(() => db.emergencyIncidents.reverse().sortBy('incidentTimestamp'), []) || [];

  // Active Selected Incident
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(initialIncidentId || qIncidentId || null);

  // Active view tab: 'CREATE' | 'DISCOVERY' | 'REFERRAL' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'CREATE' | 'DISCOVERY' | 'REFERRAL' | 'HISTORY'>(
    initialIncidentId || qIncidentId ? 'REFERRAL' : 'CREATE'
  );

  // Printable slip modal
  const [slipModalIncident, setSlipModalIncident] = useState<EmergencyIncident | null>(null);

  // Form State for New Incident
  const [isUnregistered, setIsUnregistered] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(qPatientId || '');

  useEffect(() => {
    if (qPatientId) {
      setSelectedPatientId(qPatientId);
      setIsUnregistered(false);
    }
    if (qIncidentId) {
      setActiveIncidentId(qIncidentId);
      setActiveTab('REFERRAL');
    }
  }, [qPatientId, qIncidentId]);
  const [patientName, setPatientName] = useState('');
  const [unregisteredAge, setUnregisteredAge] = useState<number | ''>('');
  const [unregisteredGender, setUnregisteredGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [category, setCategory] = useState('Maternal / Obstetric Emergency');
  const [priority, setPriority] = useState<EmergencyPriority>('critical');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [notes, setNotes] = useState('');

  // Location Distinction: Worker GPS vs Patient Incident Location
  const [workerGps, setWorkerGps] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'acquired' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [locationType, setLocationType] = useState<'same_as_worker' | 'different'>('same_as_worker');
  const [manualVillage, setManualVillage] = useState(user?.villageSector || 'Ramgarh Sector');
  const [manualLandmark, setManualLandmark] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  // Search radius for Hospital Discovery
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(25);

  // Acquire Live GPS on mount
  useEffect(() => {
    acquireWorkerLocation();
  }, []);

  const acquireWorkerLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Geolocation is not supported by this browser.');
      // Default to Ramgarh sector center coordinates as baseline fallback
      setWorkerGps({ latitude: 23.6338, longitude: 85.5145, accuracy: 50 });
      return;
    }

    setGpsStatus('acquiring');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWorkerGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsStatus('acquired');
        setGpsError(null);
      },
      (err) => {
        console.warn('[GPS] Acquisition error, falling back to sector coordinates:', err.message);
        setGpsStatus('error');
        setGpsError(err.message || 'GPS signal unavailable. Using village sector coordinates.');
        // Fallback coordinates for Ramgarh
        setWorkerGps({ latitude: 23.6338, longitude: 85.5145, accuracy: 100 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // If patient selected, auto-fill details
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);

  useEffect(() => {
    if (selectedPatient) {
      setPatientName(selectedPatient.fullName);
      setManualVillage(selectedPatient.village);
    }
  }, [selectedPatient]);

  // Find active incident
  const currentActiveIncident = useMemo(() => {
    if (activeIncidentId) {
      return incidents.find((i) => i.id === activeIncidentId) || null;
    }
    return incidents.length > 0 ? incidents[0] : null;
  }, [activeIncidentId, incidents]);

  // Destination facility object from verified dataset
  const activeSelectedFacility = useMemo(() => {
    if (!currentActiveIncident || !currentActiveIncident.facilityId) return null;
    return VERIFIED_HEALTHCARE_FACILITIES.find((f) => f.id === currentActiveIncident.facilityId) || null;
  }, [currentActiveIncident]);

  // Incident Effective GPS coordinates
  const effectivePatientLocation = useMemo(() => {
    if (currentActiveIncident) {
      return {
        latitude: currentActiveIncident.patientLatitude || workerGps?.latitude || 23.6338,
        longitude: currentActiveIncident.patientLongitude || workerGps?.longitude || 85.5145,
        label: `${currentActiveIncident.patientName} (${currentActiveIncident.village || 'Field Location'})`,
      };
    }
    return {
      latitude: workerGps?.latitude || 23.6338,
      longitude: workerGps?.longitude || 85.5145,
      label: 'Current Field Triage Point',
    };
  }, [currentActiveIncident, workerGps]);

  // Form Submission: Create SOS Incident
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetPatientName = isUnregistered
      ? patientName.trim() || 'Unidentified Emergency Victim'
      : selectedPatient?.fullName || patientName.trim();

    if (!targetPatientName) {
      alert('Please enter or select a patient name.');
      return;
    }

    const patientLat = locationType === 'same_as_worker' ? workerGps?.latitude : (workerGps?.latitude || 23.6338) + 0.005;
    const patientLng = locationType === 'same_as_worker' ? workerGps?.longitude : (workerGps?.longitude || 85.5145) + 0.005;

    const newIncident = await dbService.addEmergencyIncident({
      patientId: isUnregistered ? null : selectedPatientId || null,
      patientDisplayId: isUnregistered ? null : selectedPatient?.patientId || null,
      patientName: targetPatientName,
      isUnregistered,
      unregisteredPatientAge: isUnregistered && unregisteredAge ? Number(unregisteredAge) : null,
      unregisteredGender: isUnregistered ? unregisteredGender : null,
      ashaWorkerId: user?.id || 'asha-01',
      ashaWorkerName: user?.name || 'Sarah Jenkins',
      workerLatitude: workerGps?.latitude ?? null,
      workerLongitude: workerGps?.longitude ?? null,
      patientLatitude: patientLat ?? null,
      patientLongitude: patientLng ?? null,
      locationType,
      manualAddress: manualAddress.trim() || null,
      village: manualVillage.trim() || user?.villageSector || 'Ramgarh Sector',
      landmark: manualLandmark.trim() || null,
      category,
      priority,
      chiefComplaints: chiefComplaints.trim() || null,
      notes: notes.trim(),
      referralStatus: 'initiated',
    });

    setActiveIncidentId(newIncident.id);
    setActiveTab('DISCOVERY');
  };

  // Update existing incident
  const handleUpdateIncident = async (updates: Partial<EmergencyIncident>) => {
    if (!currentActiveIncident) return;
    await dbService.updateEmergencyIncident(currentActiveIncident.id, updates);
  };

  // Handle facility selection from map or discovery list
  const handleSelectFacility = async (fac: HealthcareFacility) => {
    if (!currentActiveIncident) {
      alert('Please initiate an emergency incident first.');
      return;
    }

    await dbService.updateEmergencyIncident(currentActiveIncident.id, {
      facilityId: fac.id,
      facilityName: fac.name,
      facilityType: fac.typeName,
      facilityPhone: fac.phone,
      facilityAddress: fac.address,
      facilityDistanceKm: fac.latitude && currentActiveIncident.patientLatitude
        ? Math.round(
            Math.sqrt(
              Math.pow((fac.latitude - currentActiveIncident.patientLatitude) * 111, 2) +
              Math.pow((fac.longitude - (currentActiveIncident.patientLongitude || 85.5145)) * 111, 2)
            ) * 10
          ) / 10
        : null,
      referralStatus: currentActiveIncident.referralStatus === 'initiated' ? 'facility_selected' : currentActiveIncident.referralStatus,
    });

    setActiveTab('REFERRAL');
  };

  return (
    <div className="w-full space-y-6 lg:space-y-8">
      {/* 1. Header Banner & Immediate 112 User-Initiated Call Trigger */}
      <div className="p-4 sm:p-5 bg-danger border-2 border-black rounded-xl shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-white animate-ping" />
            <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-white text-black border border-black shadow-brutal-xs">
              Emergency Mode Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
            🚨 SOS EMERGENCY & REFERRAL ASSISTANCE
          </h1>
          <p className="text-xs sm:text-sm font-bold text-black/90">
            Immediate field triage, nearby hospital discovery, verified transport coordination & referral slips.
          </p>
        </div>

        {/* STRICT PROTOCOL: User-Initiated Call 112 Action Button */}
        <div className="shrink-0 flex flex-col items-start md:items-end gap-1">
          <a
            href="tel:112"
            className="w-full md:w-auto px-5 py-3 rounded-xl border-2 border-black bg-white hover:bg-cream text-black font-heading font-black text-sm sm:text-base shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2.5"
            title="User-initiated call to National Emergency Response Support System (112)"
          >
            <PhoneCall className="w-5 h-5 text-danger stroke-[2.5] animate-bounce" />
            <span>CALL EMERGENCY (112)</span>
          </a>
          <span className="text-[10px] font-black text-black/80">
            User-initiated direct dial • National Emergency Services
          </span>
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b-2 border-black">
        <button
          onClick={() => setActiveTab('CREATE')}
          className={`px-4 py-2 rounded-t-lg text-xs font-heading font-black border-2 border-b-0 border-black transition-all ${
            activeTab === 'CREATE'
              ? 'bg-yellow text-black shadow-brutal-xs translate-y-[-2px]'
              : 'bg-cream text-neutral-700 hover:bg-white'
          }`}
        >
          1. SOS Incident Triage
        </button>

        <button
          onClick={() => setActiveTab('DISCOVERY')}
          className={`px-4 py-2 rounded-t-lg text-xs font-heading font-black border-2 border-b-0 border-black transition-all ${
            activeTab === 'DISCOVERY'
              ? 'bg-yellow text-black shadow-brutal-xs translate-y-[-2px]'
              : 'bg-cream text-neutral-700 hover:bg-white'
          }`}
        >
          2. Hospital Discovery & Map
        </button>

        <button
          onClick={() => setActiveTab('REFERRAL')}
          className={`px-4 py-2 rounded-t-lg text-xs font-heading font-black border-2 border-b-0 border-black transition-all ${
            activeTab === 'REFERRAL'
              ? 'bg-yellow text-black shadow-brutal-xs translate-y-[-2px]'
              : 'bg-cream text-neutral-700 hover:bg-white'
          }`}
        >
          3. Referral & Transport Workflow
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-4 py-2 rounded-t-lg text-xs font-heading font-black border-2 border-b-0 border-black transition-all ${
            activeTab === 'HISTORY'
              ? 'bg-yellow text-black shadow-brutal-xs translate-y-[-2px]'
              : 'bg-cream text-neutral-700 hover:bg-white'
          }`}
        >
          Emergency Incident Log ({incidents.length})
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: CREATE EMERGENCY INCIDENT */}
      {activeTab === 'CREATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            <form onSubmit={handleCreateIncident} className="p-5 sm:p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-5">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                <h3 className="text-base font-heading font-black text-black">
                  New Emergency Incident Triage
                </h3>
                <span className="text-xs font-bold text-neutral-600">
                  Worker: <strong>{user?.name || 'Sarah Jenkins'}</strong>
                </span>
              </div>

              {/* Patient Selection Toggle: Existing vs Unregistered */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-black">
                    <input
                      type="radio"
                      name="patientMode"
                      checked={!isUnregistered}
                      onChange={() => setIsUnregistered(false)}
                      className="accent-teal w-4 h-4"
                    />
                    <span>Select Existing Registered Patient</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-black">
                    <input
                      type="radio"
                      name="patientMode"
                      checked={isUnregistered}
                      onChange={() => setIsUnregistered(true)}
                      className="accent-danger w-4 h-4"
                    />
                    <span>Register Unregistered Emergency Case</span>
                  </label>
                </div>

                {!isUnregistered ? (
                  /* Select Existing Patient Dropdown */
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-neutral-700">
                      Search & Select Patient
                    </label>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                      required
                    >
                      <option value="">-- Select Patient from Registry --</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.patientId}] {p.fullName} • {p.age}y/{p.gender} • Village: {p.village}
                        </option>
                      ))}
                    </select>

                    {selectedPatient && (
                      <div className="p-3 bg-cream border-2 border-black rounded-lg text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-neutral-600">Patient Display ID:</span>
                          <span className="font-mono font-black text-teal text-sm">{selectedPatient.patientId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-neutral-600">Assigned Village:</span>
                          <span className="font-bold">{selectedPatient.village}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-neutral-600">Contact Number:</span>
                          <span className="font-bold">{selectedPatient.contactNumber || 'None'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Unregistered Case Fields */
                  <div className="p-4 bg-danger/10 border-2 border-danger rounded-xl space-y-3">
                    <p className="text-xs font-black text-danger-hover">
                      ⚠️ Unregistered Emergency Victim Protocol: Record details for rapid referral.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                          Patient Name / Case Description
                        </label>
                        <input
                          type="text"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="e.g. Unknown Roadside Trauma Victim"
                          className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                          Approx. Age
                        </label>
                        <input
                          type="number"
                          value={unregisteredAge}
                          onChange={(e) => setUnregisteredAge(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 30"
                          min="0"
                          max="125"
                          className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                          Gender
                        </label>
                        <select
                          value={unregisteredGender}
                          onChange={(e) => setUnregisteredGender(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Other">Other / Unknown</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Emergency Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    Emergency Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                  >
                    <option value="Maternal / Obstetric Emergency">Maternal / Obstetric (PPH, Eclampsia, Obstructed Labor)</option>
                    <option value="Severe Trauma / Accident">Severe Trauma / Road Traffic Accident</option>
                    <option value="Acute Cardiac / Chest Pain">Acute Cardiac / Chest Pain / Angina</option>
                    <option value="Pediatric Respiratory Distress">Pediatric Respiratory Distress / Severe Pneumonia</option>
                    <option value="Severe Dehydration / Shock">Severe Dehydration / Hypovolemic Shock</option>
                    <option value="Snakebite / Envenomation">Snakebite / Envenomation</option>
                    <option value="Unconscious / Unresponsive">Unconscious / Unresponsive / Coma</option>
                    <option value="High Fever with Convulsions">High Fever with Convulsions / Meningitis</option>
                    <option value="Other High-Risk Emergency">Other Acute Critical Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    Severity / Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as EmergencyPriority)}
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                  >
                    <option value="critical">🔴 Critical (Immediate Life-Threatening)</option>
                    <option value="urgent">🟡 Urgent (Requires Rapid Evaluation & Transfer)</option>
                    <option value="high">🟠 High (Serious Field Complication)</option>
                  </select>
                </div>
              </div>

              {/* Location Distinction: Worker GPS vs Patient Location */}
              <div className="p-4 border-2 border-black rounded-xl bg-cream space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-heading font-black text-black uppercase flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal stroke-[2.5]" />
                    <span>Location Specification & GPS Tracking</span>
                  </h4>
                  <button
                    type="button"
                    onClick={acquireWorkerLocation}
                    className="px-2 py-1 text-[11px] font-bold bg-white border border-black rounded shadow-brutal-xs hover:bg-yellow flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${gpsStatus === 'acquiring' ? 'animate-spin' : ''}`} />
                    <span>Refresh GPS</span>
                  </button>
                </div>

                {/* Worker GPS status pill */}
                <div className="p-2.5 bg-white border-2 border-black rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-700">ASHA Worker Current Device Location:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
                      gpsStatus === 'acquired' ? 'bg-teal text-white' : 'bg-yellow text-black'
                    }`}>
                      {gpsStatus === 'acquired' ? `✓ Acquired (±${workerGps?.accuracy}m)` : gpsStatus}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-neutral-600">
                    {formatCoordinates(workerGps?.latitude, workerGps?.longitude)}
                  </p>
                </div>

                {/* Patient Location Distinction Toggle */}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-black text-neutral-700">Patient Emergency Location:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-lg border-2 border-black cursor-pointer text-xs flex items-center gap-2 ${
                      locationType === 'same_as_worker' ? 'bg-yellow font-black shadow-brutal-xs' : 'bg-white font-bold'
                    }`}>
                      <input
                        type="radio"
                        name="locType"
                        checked={locationType === 'same_as_worker'}
                        onChange={() => setLocationType('same_as_worker')}
                        className="accent-black"
                      />
                      <span>Patient is at my current GPS position</span>
                    </label>

                    <label className={`p-2.5 rounded-lg border-2 border-black cursor-pointer text-xs flex items-center gap-2 ${
                      locationType === 'different' ? 'bg-yellow font-black shadow-brutal-xs' : 'bg-white font-bold'
                    }`}>
                      <input
                        type="radio"
                        name="locType"
                        checked={locationType === 'different'}
                        onChange={() => setLocationType('different')}
                        className="accent-black"
                      />
                      <span>Patient is at a different location</span>
                    </label>
                  </div>
                </div>

                {/* Manual Address & Village Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                      Village / Tola / Hamlet
                    </label>
                    <input
                      type="text"
                      value={manualVillage}
                      onChange={(e) => setManualVillage(e.target.value)}
                      placeholder="e.g. Ramgarh Basti / Murram Kalan"
                      className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                      Landmark / Road
                    </label>
                    <input
                      type="text"
                      value={manualLandmark}
                      onChange={(e) => setManualLandmark(e.target.value)}
                      placeholder="e.g. Near Panchayat Bhawan, NH 33"
                      className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Notes & Chief Complaints */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    Chief Complaints & Visible Symptoms
                  </label>
                  <input
                    type="text"
                    value={chiefComplaints}
                    onChange={(e) => setChiefComplaints(e.target.value)}
                    placeholder="e.g. Sudden severe bleeding, systolic BP 80/50, patient pale and lethargic"
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    Field Notes & Immediate First Aid Administered
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Legs elevated, warm blanket provided, ORS/IV initiated if trained, family prepared for immediate referral transfer"
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-brutal-xs"
                  />
                </div>
              </div>

              {/* Action Submit */}
              <div className="pt-3 border-t-2 border-black flex items-center justify-between">
                <span className="text-xs text-neutral-600 font-bold">
                  Saves locally instantly in IndexedDB & queues for automatic sync.
                </span>
                <BrutalButton
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={<ArrowRight className="w-4 h-4 text-black stroke-[3]" />}
                >
                  Create Incident & Discover Hospitals
                </BrutalButton>
              </div>
            </form>
          </div>

          {/* Right Column: Quick Guidance & Active Emergency Summary (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Quick Emergency Protocol Card */}
            <div className="p-4 bg-yellow border-2 border-black rounded-xl shadow-brutal space-y-2.5">
              <h4 className="text-xs font-heading font-black text-black uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-black stroke-[2.5]" />
                <span>ASHA Emergency Referral Protocol</span>
              </h4>
              <ul className="text-xs font-bold text-neutral-900 space-y-1.5 pl-4 list-disc">
                <li>Check consciousness, airway, breathing and pulse immediately.</li>
                <li>Never delay transfer for paperwork: initiate referral early.</li>
                <li>Dial 112 or local 108 ambulance control room.</li>
                <li>Accompany the patient to the referral facility when feasible.</li>
                <li>Hand over the printed referral slip to the receiving medical officer.</li>
              </ul>
            </div>

            {/* Offline Safeguard Card */}
            <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal" />
                <h4 className="text-xs font-heading font-black text-black uppercase">
                  Offline-First Architecture
                </h4>
              </div>
              <p className="text-xs text-neutral-700 font-bold">
                All emergency incidents, contact logs and transport records are stored safely on this device. When cellular connection returns, records automatically sync to the district health database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOSPITAL DISCOVERY & INTERACTIVE MAP */}
      {activeTab === 'DISCOVERY' && (
        <div className="space-y-6">
          {/* Active Incident Banner */}
          {currentActiveIncident && (
            <div className="p-3.5 bg-yellow border-2 border-black rounded-xl shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase text-neutral-800">Active Emergency Incident:</span>
                <p className="text-sm font-heading font-black text-black">
                  🚨 {currentActiveIncident.patientName} • {currentActiveIncident.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('CREATE')}
                  className="px-2.5 py-1 text-xs font-black bg-white border border-black rounded shadow-brutal-xs hover:bg-cream"
                >
                  Edit Triage
                </button>
                <button
                  onClick={() => setActiveTab('REFERRAL')}
                  className="px-3 py-1 text-xs font-black bg-teal text-white border border-black rounded shadow-brutal-xs hover:bg-teal-hover"
                >
                  Continue to Referral →
                </button>
              </div>
            </div>
          )}

          {/* Leaflet Interactive Map */}
          <EmergencyMap
            patientLocation={effectivePatientLocation}
            workerLocation={workerGps}
            facilities={VERIFIED_HEALTHCARE_FACILITIES}
            selectedFacilityId={currentActiveIncident?.facilityId}
            searchRadiusKm={searchRadiusKm}
            onSelectFacility={handleSelectFacility}
          />

          {/* Hospital Discovery List */}
          <HospitalDiscovery
            patientLocation={effectivePatientLocation}
            facilities={VERIFIED_HEALTHCARE_FACILITIES}
            selectedFacilityId={currentActiveIncident?.facilityId}
            searchRadiusKm={searchRadiusKm}
            onRadiusChange={(r) => setSearchRadiusKm(r)}
            onSelectFacility={handleSelectFacility}
          />
        </div>
      )}

      {/* TAB 3: REFERRAL & TRANSPORT WORKFLOW */}
      {activeTab === 'REFERRAL' && (
        <div className="space-y-6">
          {currentActiveIncident ? (
            <ReferralWorkflow
              incident={currentActiveIncident}
              selectedFacility={activeSelectedFacility}
              onUpdateIncident={handleUpdateIncident}
              onOpenReferralSlip={() => setSlipModalIncident(currentActiveIncident)}
            />
          ) : (
            <div className="p-8 bg-white border-2 border-black rounded-xl shadow-brutal text-center space-y-3">
              <p className="text-sm font-black text-black">
                No active emergency incident selected.
              </p>
              <BrutalButton
                variant="primary"
                size="md"
                onClick={() => setActiveTab('CREATE')}
              >
                Initiate New Emergency Case
              </BrutalButton>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECENT EMERGENCY LOG */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal flex items-center justify-between">
            <div>
              <h3 className="text-sm font-heading font-black text-black">
                Emergency Referral Log
              </h3>
              <p className="text-xs text-neutral-600 font-bold">
                {incidents.length} recorded emergency incident(s) stored on this device
              </p>
            </div>
            <button
              onClick={() => {
                setActiveIncidentId(null);
                setActiveTab('CREATE');
              }}
              className="px-3 py-1.5 bg-yellow border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs hover:bg-yellow-hover flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>New Emergency Case</span>
            </button>
          </div>

          <div className="space-y-3">
            {incidents.length === 0 ? (
              <div className="p-8 bg-cream border-2 border-dashed border-black/30 rounded-xl text-center">
                <p className="text-sm font-bold text-neutral-600">
                  No emergency referral incidents recorded yet.
                </p>
              </div>
            ) : (
              incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-teal">
                        {inc.incidentCode}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded border border-black bg-danger text-black">
                        {inc.priority}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded border border-black bg-cream text-black">
                        Status: {inc.referralStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-base font-heading font-black text-black">
                      {inc.patientName} {inc.patientDisplayId ? `(${inc.patientDisplayId})` : ''}
                    </h4>

                    <p className="text-xs text-neutral-700 font-bold">
                      Category: {inc.category} • Location: {inc.village || 'Field'}
                    </p>

                    {inc.facilityName && (
                      <p className="text-xs text-teal font-black">
                        Referred to: {inc.facilityName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSlipModalIncident(inc)}
                      className="px-3 py-1.5 bg-cream border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs hover:bg-white flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Referral Slip</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveIncidentId(inc.id);
                        setActiveTab('REFERRAL');
                      }}
                      className="px-3 py-1.5 bg-yellow border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs hover:bg-yellow-hover flex items-center gap-1"
                    >
                      <span>Manage Referral</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Printable Referral Slip Modal */}
      {slipModalIncident && (
        <ReferralSlipModal
          incident={slipModalIncident}
          onClose={() => setSlipModalIncident(null)}
        />
      )}
    </div>
  );
};

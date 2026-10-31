export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed' | 'conflict';

export type FollowUpCategory =
  | 'General check-up'
  | 'Maternal health follow-up'
  | 'Child wellness follow-up'
  | 'Medication adherence check'
  | 'Routine follow-up';

export type FollowUpStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Patient {
  id: string; // UUID
  patientId: string; // Fictional display ID e.g. "RC-2026-001"
  fullName: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  village: string;
  contactNumber: string; // Contact phone number
  chwAssigned: string; // Community Health Worker Name
  registrationDate: string; // ISO date string
  notes?: string;
  syncStatus: SyncStatus;
  version: number;
  lastModified: string;
}

export interface FollowUp {
  id: string; // UUID
  patientId: string; // References Patient.id
  patientDisplayId: string;
  patientName: string;
  visitDate: string; // Local calendar date string YYYY-MM-DD or ISO timestamp
  scheduledTime?: string; // Optional time e.g. "10:30 AM" or "10:30"
  category: FollowUpCategory;
  observations: string; // Purpose when scheduled; clinical/field notes when completed
  notes: string;
  nextFollowUpDate?: string;
  status: FollowUpStatus;
  priority?: TaskPriority;
  completedAt?: string;
  chwName: string;
  syncStatus: SyncStatus;
  version: number;
  lastModified: string;
}

export interface Task {
  id: string; // UUID
  title: string;
  patientId?: string;
  patientDisplayId?: string;
  patientName?: string;
  dueDate: string; // YYYY-MM-DD
  scheduledTime?: string;
  priority: TaskPriority;
  completed: boolean;
  completedAt?: string;
  assignedChw: string;
  category: FollowUpCategory | 'Administrative';
  followUpId?: string;
  syncStatus: SyncStatus;
  version: number;
  lastModified: string;
}

export interface FieldworkVisitItem {
  id: string;
  type: 'visit' | 'task';
  followUpId?: string;
  taskId?: string;
  patientId?: string;
  patientDisplayId: string;
  patientName: string;
  title: string;
  category: FollowUpCategory | string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime?: string;
  purpose: string;
  priority: TaskPriority;
  status: 'Due Today' | 'In Progress' | 'Completed' | 'Overdue';
  rawStatus: FollowUpStatus | string;
  completed: boolean;
  completedAt?: string;
  followUpRecord?: FollowUp;
}

export interface NotificationItem {
  id: string;
  visitId: string;
  patientId: string;
  patientDisplayId: string;
  patientName: string;
  category: string;
  scheduledDate: string;
  scheduledTime?: string;
  priority: TaskPriority;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export type EmergencyPriority = 'urgent' | 'critical' | 'high';

export type ReferralStatus =
  | 'initiated'
  | 'facility_selected'
  | 'transport_arranged'
  | 'in_transit'
  | 'arrived'
  | 'completed'
  | 'cancelled';

export interface ContactAttempt {
  id: string;
  timestamp: string;
  recipient: string;
  phone?: string;
  outcome: string; // e.g. "Reached - Bed Confirmed", "Reached - Diverted", "Line Busy", "No Answer"
  notes?: string;
}

export interface HealthcareFacility {
  id: string;
  name: string;
  facilityCode: string; // Official NIN / PM-JAY registry code
  type: 'PHC' | 'CHC' | 'SDH' | 'DH' | 'Private';
  typeName: string; // e.g. "Primary Health Centre", "Community Health Centre", "Sub-Divisional Hospital", "District Hospital", "Private Hospital"
  isGovernment: boolean;
  address: string;
  villageOrTown: string;
  district: string;
  pincode: string;
  phone: string;
  ambulancePhone?: string;
  latitude: number;
  longitude: number;
  emergencyAvailable24x7: boolean;
  capabilities: string[]; // e.g. ["24x7 Emergency", "Maternity & FRU", "Blood Bank", "Neonatal Care", "Trauma Care"]
  verifiedDate: string; // Official verification record timestamp
}

export interface EmergencyIncident {
  id: string; // UUID
  incidentCode: string; // e.g. "EMG-2026-001"
  patientId?: string | null;
  patientDisplayId?: string | null;
  patientName: string;
  isUnregistered?: boolean;
  unregisteredPatientAge?: number | null;
  unregisteredGender?: string | null;
  ashaWorkerId?: string;
  ashaWorkerName: string;
  incidentTimestamp: string;

  // GPS & Location tracking
  workerLatitude?: number | null;
  workerLongitude?: number | null;
  patientLatitude?: number | null;
  patientLongitude?: number | null;
  locationType: 'same_as_worker' | 'different';
  manualAddress?: string | null;
  village?: string | null;
  landmark?: string | null;

  // Clinical / Emergency
  category: string;
  priority: EmergencyPriority;
  chiefComplaints?: string | null;
  notes: string;

  // Referral Workflow
  referralStatus: ReferralStatus;
  facilityId?: string | null;
  facilityName?: string | null;
  facilityType?: string | null;
  facilityPhone?: string | null;
  facilityAddress?: string | null;
  facilityDistanceKm?: number | null;

  contactAttempts?: ContactAttempt[];
  transportType?: string | null;
  transportContact?: string | null;
  transportNotes?: string | null;
  dispatchConfirmed?: boolean;

  arrivedAt?: string | null;
  handoverTo?: string | null;
  handoverNotes?: string | null;

  referralCode?: string | null; // e.g. "REF-2026-98124"

  syncStatus: SyncStatus;
  version: number;
  lastModified: string;
  createdAt?: string;
}

export interface SyncQueueItem {
  id: string; // Unique queue UUID
  idempotencyKey?: string; // Idempotency fingerprint to prevent duplicate processing
  entityId: string;
  entityType: 'patient' | 'followup' | 'task' | 'emergency';
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  nextRetryTime?: number; // Milliseconds timestamp for exponential backoff
  lastAttempt?: string;
  errorMessage?: string;
  patientDisplayId?: string; // e.g. "RC-2026-001" for transparent display
  patientName?: string;
  summary?: string; // Human-readable label for CHW inspection
}

export interface SyncConflict {
  id: string;
  entityType: 'patient' | 'followup' | 'task' | 'emergency';
  entityId: string;
  localVersion: any;
  serverVersion: any;
  detectedAt: string;
  resolved: boolean;
  resolutionChoice?: 'LOCAL' | 'SERVER' | 'MANUAL';
}

export interface CHWUser {
  id: string;
  name: string;
  role: string;
  villageZone: string;
  phoneNumber: string;
}

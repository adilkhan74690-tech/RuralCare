export type SyncStatus = 'synced' | 'pending' | 'failed' | 'conflict';

export type FollowUpCategory =
  | 'General check-up'
  | 'Maternal health follow-up'
  | 'Child wellness follow-up'
  | 'Medication adherence check'
  | 'Routine follow-up';

export type FollowUpStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

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
  visitDate: string;
  category: FollowUpCategory;
  observations: string; // General administrative observations (no medical diagnosis)
  notes: string;
  nextFollowUpDate?: string;
  status: FollowUpStatus;
  chwName: string;
  syncStatus: SyncStatus;
  version: number;
  lastModified: string;
}

export interface Task {
  id: string; // UUID
  title: string;
  patientId?: string;
  patientName?: string;
  dueDate: string;
  priority: TaskPriority;
  completed: boolean;
  completedAt?: string;
  assignedChw: string;
  category: FollowUpCategory | 'Administrative';
  syncStatus: SyncStatus;
  version: number;
  lastModified: string;
}

export interface SyncQueueItem {
  id: string; // UUID
  entityId: string;
  entityType: 'patient' | 'followup' | 'task';
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  lastAttempt?: string;
  errorMessage?: string;
}

export interface SyncConflict {
  id: string;
  entityType: 'patient' | 'followup' | 'task';
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

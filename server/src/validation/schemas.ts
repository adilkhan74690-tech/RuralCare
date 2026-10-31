import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty')
    .max(128, 'Password is too long'),
});

export const patientPayloadSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  patientId: z.string().max(50).optional(),
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(1, 'Full name cannot be empty')
    .max(150, 'Full name cannot exceed 150 characters'),
  age: z.coerce
    .number({ invalid_type_error: 'Age must be a valid number' })
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(130, 'Please enter a realistic age (0-130)'),
  gender: z.enum(['Female', 'Male', 'Other']).default('Other'),
  village: z
    .string({ required_error: 'Village is required' })
    .trim()
    .min(1, 'Village name cannot be empty')
    .max(100, 'Village name cannot exceed 100 characters'),
  contactNumber: z.string().max(35).default(''),
  chwAssigned: z.string().max(100).optional(),
  registrationDate: z.string().optional(),
  notes: z.string().max(5000).optional().default(''),
  syncStatus: z.string().max(20).optional().default('synced'),
  version: z.coerce.number().int().min(1).default(1),
  lastModified: z.string().optional(),
});

export const followUpPayloadSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  patientId: z.string({ required_error: 'patientId is required' }).min(1).max(100),
  patientDisplayId: z.string().max(50).optional(),
  patientName: z
    .string({ required_error: 'patientName is required' })
    .trim()
    .min(1)
    .max(150),
  visitDate: z.string({ required_error: 'visitDate is required' }).min(1),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(1)
    .max(100),
  observations: z
    .string({ required_error: 'Observations are required' })
    .trim()
    .min(1, 'Observations cannot be empty')
    .max(5000),
  notes: z.string().max(5000).optional().default(''),
  nextFollowUpDate: z.string().nullable().optional(),
  status: z.enum(['scheduled', 'completed', 'missed', 'cancelled']).default('completed'),
  chwName: z.string().max(100).optional(),
  syncStatus: z.string().max(20).optional().default('synced'),
  version: z.coerce.number().int().min(1).default(1),
  lastModified: z.string().optional(),
});

export const taskPayloadSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Task title cannot be empty')
    .max(200),
  patientId: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  dueDate: z.string({ required_error: 'dueDate is required' }).min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  completed: z.boolean().default(false),
  completedAt: z.string().nullable().optional(),
  assignedChw: z.string().max(100).optional(),
  category: z.string().max(100).default('Administrative'),
  syncStatus: z.string().max(20).optional().default('synced'),
  version: z.coerce.number().int().min(1).default(1),
  lastModified: z.string().optional(),
});

export const syncItemSchema = z.object({
  id: z.string({ required_error: 'Item id is required' }).min(1).max(100),
  entityId: z.string({ required_error: 'entityId is required' }).min(1).max(100),
  entityType: z.enum(['patient', 'followup', 'task']),
  operationType: z.enum(['CREATE', 'UPDATE', 'DELETE']).default('CREATE'),
  payload: z.record(z.any()),
  createdAt: z.string().optional(),
  status: z.string().optional(),
  retryCount: z.number().int().optional(),
});

export const syncBatchSchema = z.object({
  items: z
    .array(syncItemSchema, { required_error: 'items must be an array' })
    .max(500, 'Sync batch cannot exceed 500 items per request'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
export type SyncItemInput = z.infer<typeof syncItemSchema>;

export const provisionUserSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password is too long'),
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name cannot be empty')
    .max(150, 'Name cannot exceed 150 characters'),
  role: z
    .enum(['Community Health Worker', 'Healthcare Supervisor', 'CHW', 'Supervisor', 'Admin'])
    .default('Community Health Worker'),
  villageZone: z
    .string()
    .trim()
    .min(1, 'Village zone cannot be empty')
    .default('General Health Sector'),
  phoneNumber: z.string().max(35).optional().default(''),
});

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;

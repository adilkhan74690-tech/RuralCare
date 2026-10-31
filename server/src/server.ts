import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import { prisma } from './prisma';
import {
  authenticateToken,
  revokeToken,
  isSupervisor,
  AuthRequest,
} from './middleware/auth';
import { authLimiter, apiLimiter, syncLimiter } from './middleware/rateLimiter';
import {
  loginSchema,
  syncBatchSchema,
  patientPayloadSchema,
  followUpPayloadSchema,
  taskPayloadSchema,
} from './validation/schemas';

const app = express();

// Disable Express fingerprinting header
app.disable('x-powered-by');

// HTTP Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // APIs typically serve JSON; allow embedding/CORS as needed
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration restricting origins strictly (in production, only configured client origin is permitted)
const allowedOrigins =
  env.NODE_ENV === 'production'
    ? [env.CLIENT_URL]
    : [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server) or in whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Access denied for this origin.'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Enforce HTTPS in production via reverse proxy protocol check
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Payload size limit to prevent memory exhaustion
app.use(express.json({ limit: '2mb' }));

// Apply general API rate limiting to all /api/ routes
app.use('/api/', apiLimiter);

// Minimal privacy-preserving request logger (no PII or auth headers logged)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[API] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Seed default official healthcare worker accounts if table is empty
async function ensureDefaultAccounts() {
  try {
    // In production, automatic default accounts with hardcoded passwords are strictly disabled
    if (env.NODE_ENV === 'production') {
      console.log('[Auth] Production mode detected: Automatic default staff account seeding is disabled.');
      return;
    }

    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Auth] Initializing default healthcare staff accounts in PostgreSQL (Development/Test Mode)...');
      const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Password@123';
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

      const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

      await prisma.user.createMany({
        data: [
          {
            name: 'Sarah Jenkins',
            email: 'sarah.jenkins@ruralcare.org',
            passwordHash: defaultPasswordHash,
            role: 'Community Health Worker',
            villageZone: 'Ramgarh Health Sector',
            phoneNumber: '+91 98765 43210',
          },
          {
            name: 'Anita Murmu',
            email: 'anita.murmu@ruralcare.org',
            passwordHash: defaultPasswordHash,
            role: 'Community Health Worker',
            villageZone: 'Chandrapura Sector',
            phoneNumber: '+91 98765 11223',
          },
          {
            name: 'Dr. Alok Verma',
            email: 'admin@ruralcare.org',
            passwordHash: adminPasswordHash,
            role: 'Healthcare Supervisor',
            villageZone: 'District Headquarters',
            phoneNumber: '+91 98765 00001',
          },
        ],
      });
      console.log('[Auth] Default accounts created in PostgreSQL successfully.');
    }
  } catch (err) {
    console.error('[Auth] Error ensuring default accounts:', err instanceof Error ? err.message : 'Unknown');
  }
}

// Health check endpoint (Sanitized error response)
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: 'Database service is currently unreachable.',
    });
  }
});

// Authentication Endpoint (Strict rate-limited, Zod-validated, async bcrypt)
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        success: false,
        error: issue ? issue.message : 'Invalid login payload.',
      });
    }

    const { email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        villageZone: user.villageZone,
        jti: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      env.JWT_SECRET,
      { expiresIn: (env.JWT_EXPIRES_IN || '1d') as any }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        villageSector: user.villageZone,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error');
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during authentication.',
    });
  }
});

// Logout endpoint - Invalidate active session token
app.post('/api/auth/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.token) {
    revokeToken(req.token);
  }
  return res.json({
    success: true,
    message: 'Logged out successfully. Session token revoked.',
  });
});

// User session verification endpoint
app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
      villageSector: req.user!.villageZone,
      phoneNumber: req.user!.phoneNumber,
    },
  });
});

// Helper to safely parse and clamp dates within valid PostgreSQL ranges (1900-2100)
function parseSafeDate(val: any, fallback: Date | null = new Date()): Date | null {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    const year = d.getFullYear();
    if (year < 1900 || year > 2100) {
      const str = String(val);
      const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return new Date(`2026-${match[2]}-${match[3]}`);
      }
      return fallback;
    }
    return d;
  } catch {
    return fallback;
  }
}

// Sync endpoint - Authenticated, rate-limited, Zod-validated, IDOR-protected, version-aware
app.post('/api/sync', authenticateToken, syncLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = syncBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        success: false,
        error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid sync request payload.',
      });
    }

    const { items } = parseResult.data;
    const authenticatedUser = req.user!;
    const userIsSupervisor = isSupervisor(authenticatedUser.role);

    const processedIds: string[] = [];
    const failedItems: Array<{ id: string; error: string }> = [];

    // Sort items so 'patient' records are processed first (satisfies foreign key constraints)
    const sortedItems = [...items].sort((a, b) => {
      const order: Record<string, number> = { patient: 1, task: 2, followup: 3 };
      return (order[a.entityType] || 99) - (order[b.entityType] || 99);
    });

    for (const item of sortedItems) {
      try {
        const { entityId, entityType, operationType, payload } = item;

        // Idempotency check: Skip duplicate if client already synchronized this exact event
        const existingAudit = await prisma.syncAuditLog.findFirst({
          where: {
            entityId,
            clientTimestamp: item.createdAt ? parseSafeDate(item.createdAt, null) : undefined,
            status: 'synced',
          },
        });
        if (existingAudit && item.createdAt) {
          processedIds.push(item.id);
          continue;
        }

        if (entityType === 'patient') {
          const patientParse = patientPayloadSchema.safeParse(payload);
          if (!patientParse.success) {
            failedItems.push({
              id: item.id,
              error: `Patient validation failed: ${patientParse.error.issues[0]?.message || 'Invalid fields'}`,
            });
            continue;
          }
          const validPatient = patientParse.data;

          const targetId = validPatient.id || entityId;
          const regDate = parseSafeDate(validPatient.registrationDate, new Date()) || new Date();
          const lastMod = parseSafeDate(validPatient.lastModified, new Date()) || new Date();
          const patientDisplayId = validPatient.patientId || `RC-${targetId.slice(0, 8)}`;
          const villageName = validPatient.village;

          // Check if patient already exists for ownership & version checks
          const existingPatient = await prisma.patient.findUnique({
            where: { id: targetId },
          });

          if (existingPatient) {
            // IDOR & Patient Ownership Enforcement:
            // Non-supervisor CHW can only update patients assigned to them
            if (!userIsSupervisor && existingPatient.chwAssigned !== authenticatedUser.name) {
              failedItems.push({
                id: item.id,
                error: 'Forbidden: You cannot modify a patient record assigned to another healthcare worker.',
              });
              continue;
            }

            // Version Conflict Check:
            if (operationType === 'UPDATE' && validPatient.version < existingPatient.version) {
              failedItems.push({
                id: item.id,
                error: `Version conflict: Server record has version ${existingPatient.version}, incoming is ${validPatient.version}.`,
              });
              continue;
            }

            await prisma.patient.update({
              where: { id: targetId },
              data: {
                patientId: patientDisplayId,
                fullName: validPatient.fullName,
                age: validPatient.age,
                gender: validPatient.gender,
                village: villageName,
                contactNumber: validPatient.contactNumber,
                // Supervisors can reassign; CHWs remain the assigned worker
                chwAssigned: userIsSupervisor && validPatient.chwAssigned ? validPatient.chwAssigned : existingPatient.chwAssigned,
                notes: validPatient.notes || '',
                syncStatus: 'synced',
                version: Math.max(existingPatient.version + 1, validPatient.version + 1),
                lastModified: lastMod,
              },
            });
          } else {
            // New patient creation:
            // For CHW role, always bind ownership to authenticated user
            const assignedCHW = userIsSupervisor && validPatient.chwAssigned ? validPatient.chwAssigned : authenticatedUser.name;

            await prisma.patient.create({
              data: {
                id: targetId,
                patientId: patientDisplayId,
                fullName: validPatient.fullName,
                age: validPatient.age,
                gender: validPatient.gender,
                village: villageName,
                contactNumber: validPatient.contactNumber,
                chwAssigned: assignedCHW,
                registrationDate: regDate,
                notes: validPatient.notes || '',
                syncStatus: 'synced',
                version: validPatient.version || 1,
                lastModified: lastMod,
              },
            });
          }

          await prisma.syncAuditLog.create({
            data: {
              entityType: 'patient',
              entityId: targetId,
              operationType: operationType || 'CREATE',
              payload: validPatient,
              status: 'synced',
              clientTimestamp: parseSafeDate(item.createdAt, new Date()),
            },
          });

          processedIds.push(item.id);
        } else if (entityType === 'followup') {
          const fuParse = followUpPayloadSchema.safeParse(payload);
          if (!fuParse.success) {
            failedItems.push({
              id: item.id,
              error: `FollowUp validation failed: ${fuParse.error.issues[0]?.message || 'Invalid fields'}`,
            });
            continue;
          }
          const validFu = fuParse.data;

          const targetId = validFu.id || entityId;
          const visitDate = parseSafeDate(validFu.visitDate, new Date()) || new Date();
          const nextDate = validFu.nextFollowUpDate ? parseSafeDate(validFu.nextFollowUpDate, null) : null;
          const lastMod = parseSafeDate(validFu.lastModified, new Date()) || new Date();

          // Ensure parent patient exists and belongs to this worker (unless supervisor)
          const parentPatient = await prisma.patient.findUnique({
            where: { id: validFu.patientId },
          });

          if (!parentPatient) {
            failedItems.push({
              id: item.id,
              error: `Parent patient ${validFu.patientId} does not exist.`,
            });
            continue;
          }

          if (!userIsSupervisor && parentPatient.chwAssigned !== authenticatedUser.name) {
            failedItems.push({
              id: item.id,
              error: 'Forbidden: You cannot record follow-up visits for a patient assigned to another healthcare worker.',
            });
            continue;
          }

          const existingFu = await prisma.followUp.findUnique({
            where: { id: targetId },
          });

          if (existingFu && operationType === 'UPDATE' && validFu.version < existingFu.version) {
            failedItems.push({
              id: item.id,
              error: `Version conflict on follow-up: Server is version ${existingFu.version}.`,
            });
            continue;
          }

          const chwName = userIsSupervisor && validFu.chwName ? validFu.chwName : authenticatedUser.name;

          await prisma.followUp.upsert({
            where: { id: targetId },
            update: {
              patientId: validFu.patientId,
              patientDisplayId: validFu.patientDisplayId || parentPatient.patientId,
              patientName: validFu.patientName,
              visitDate,
              category: validFu.category,
              observations: validFu.observations,
              notes: validFu.notes || '',
              nextFollowUpDate: nextDate,
              status: validFu.status || 'completed',
              chwName,
              syncStatus: 'synced',
              version: existingFu ? existingFu.version + 1 : validFu.version || 1,
              lastModified: lastMod,
            },
            create: {
              id: targetId,
              patientId: validFu.patientId,
              patientDisplayId: validFu.patientDisplayId || parentPatient.patientId,
              patientName: validFu.patientName,
              visitDate,
              category: validFu.category,
              observations: validFu.observations,
              notes: validFu.notes || '',
              nextFollowUpDate: nextDate,
              status: validFu.status || 'completed',
              chwName,
              syncStatus: 'synced',
              version: validFu.version || 1,
              lastModified: lastMod,
            },
          });

          await prisma.syncAuditLog.create({
            data: {
              entityType: 'followup',
              entityId: targetId,
              operationType: operationType || 'CREATE',
              payload: validFu,
              status: 'synced',
              clientTimestamp: parseSafeDate(item.createdAt, new Date()),
            },
          });

          processedIds.push(item.id);
        } else if (entityType === 'task') {
          const taskParse = taskPayloadSchema.safeParse(payload);
          if (!taskParse.success) {
            failedItems.push({
              id: item.id,
              error: `Task validation failed: ${taskParse.error.issues[0]?.message || 'Invalid fields'}`,
            });
            continue;
          }
          const validTask = taskParse.data;

          const targetId = validTask.id || entityId;
          const dueDate = parseSafeDate(validTask.dueDate, new Date()) || new Date();
          const completedAt = validTask.completedAt ? parseSafeDate(validTask.completedAt, null) : null;
          const lastMod = parseSafeDate(validTask.lastModified, new Date()) || new Date();

          let validPatientId: string | null = null;
          if (validTask.patientId) {
            const pExists = await prisma.patient.findUnique({ where: { id: validTask.patientId } });
            if (pExists) {
              if (!userIsSupervisor && pExists.chwAssigned !== authenticatedUser.name) {
                failedItems.push({
                  id: item.id,
                  error: 'Forbidden: You cannot assign or modify tasks for another worker\'s patient.',
                });
                continue;
              }
              validPatientId = validTask.patientId;
            }
          }

          const existingTask = await prisma.task.findUnique({
            where: { id: targetId },
          });

          if (existingTask && !userIsSupervisor && existingTask.assignedChw !== authenticatedUser.name) {
            failedItems.push({
              id: item.id,
              error: 'Forbidden: You cannot update a task assigned to another worker.',
            });
            continue;
          }

          const assignedChw = userIsSupervisor && validTask.assignedChw ? validTask.assignedChw : authenticatedUser.name;

          await prisma.task.upsert({
            where: { id: targetId },
            update: {
              title: validTask.title,
              patientId: validPatientId,
              patientName: validTask.patientName || null,
              dueDate,
              priority: validTask.priority,
              completed: Boolean(validTask.completed),
              completedAt,
              assignedChw,
              category: validTask.category,
              syncStatus: 'synced',
              version: existingTask ? existingTask.version + 1 : validTask.version || 1,
              lastModified: lastMod,
            },
            create: {
              id: targetId,
              title: validTask.title,
              patientId: validPatientId,
              patientName: validTask.patientName || null,
              dueDate,
              priority: validTask.priority,
              completed: Boolean(validTask.completed),
              completedAt,
              assignedChw,
              category: validTask.category,
              syncStatus: 'synced',
              version: validTask.version || 1,
              lastModified: lastMod,
            },
          });

          await prisma.syncAuditLog.create({
            data: {
              entityType: 'task',
              entityId: targetId,
              operationType: operationType || 'CREATE',
              payload: validTask,
              status: 'synced',
              clientTimestamp: parseSafeDate(item.createdAt, new Date()),
            },
          });

          processedIds.push(item.id);
        }
      } catch (itemError: any) {
        failedItems.push({
          id: item.id,
          error: 'An internal error occurred processing this queue item.',
        });
      }
    }

    return res.json({
      success: true,
      processedIds,
      failedItems,
      syncedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing synchronization batch.',
    });
  }
});

// Patient Query Endpoint: Authenticated & Scoped to Worker/Supervisor
app.get('/api/patients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const userIsSupervisor = isSupervisor(user.role);

    // CHWs are strictly scoped to their assigned patients; Supervisors see all sector patients
    const whereClause = userIsSupervisor
      ? {}
      : {
          chwAssigned: user.name,
        };

    const patients = await prisma.patient.findMany({
      where: whereClause,
      orderBy: { registrationDate: 'desc' },
      include: { followUps: true, tasks: true },
    });

    res.json({ success: true, count: patients.length, data: patients });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retrieve patient records.' });
  }
});

// Follow-ups Query Endpoint: Authenticated & Scoped
app.get('/api/follow-ups', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const userIsSupervisor = isSupervisor(user.role);

    const whereClause = userIsSupervisor
      ? {}
      : {
          chwName: user.name,
        };

    const followUps = await prisma.followUp.findMany({
      where: whereClause,
      orderBy: { visitDate: 'desc' },
    });

    res.json({ success: true, count: followUps.length, data: followUps });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retrieve follow-up records.' });
  }
});

// Tasks Query Endpoint: Authenticated & Scoped
app.get('/api/tasks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const userIsSupervisor = isSupervisor(user.role);

    const whereClause = userIsSupervisor
      ? {}
      : {
          assignedChw: user.name,
        };

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, count: tasks.length, data: tasks });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retrieve tasks.' });
  }
});

// Centralized generic error handler (OWASP ASVS error leakage protection)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err?.name || 'ServerError');
  res.status(err.status || 500).json({
    success: false,
    error: 'An internal server error occurred.',
  });
});

// Export app for test suites
export { app };

// Start Express server
const PORT = env.PORT || 5000;
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 RuralCare Connect Hardened API running at http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Auth Endpoints: http://localhost:${PORT}/api/auth/login`);
    console.log(`🔄 Sync Endpoint: http://localhost:${PORT}/api/sync`);
    await ensureDefaultAccounts();
  });
}

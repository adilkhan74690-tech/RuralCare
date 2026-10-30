import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import { prisma } from './prisma';

const app = express();

app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Seed default official healthcare worker accounts if table is empty
async function ensureDefaultAccounts() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Auth] Initializing default healthcare staff accounts in PostgreSQL...');
      const defaultPasswordHash = bcrypt.hashSync('Password@123', 10);
      const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);

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
    console.error('[Auth] Error ensuring default accounts:', err);
  }
}

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Real Database-backed Authentication Endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      });
    }

    const isMatch = bcrypt.compareSync(String(password), user.passwordHash);
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
      },
      env.JWT_SECRET,
      { expiresIn: (env.JWT_EXPIRES_IN || '7d') as any }
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
    console.error('[Auth] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during authentication.',
    });
  }
});

// User session verification endpoint
app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        villageZone: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    return res.json({
      success: true,
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
    return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
  }
});

// Helper to safely parse and clamp dates within valid PostgreSQL ranges (1900-2100)
function parseSafeDate(val: any, fallback: Date | null = new Date()): Date | null {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    const year = d.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`[Sync] Normalizing out-of-range date year ${year} ("${val}").`);
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

// Sync endpoint - Receives offline queue batch and persists into PostgreSQL
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "items" must be an array of SyncQueueItem',
      });
    }

    console.log(`[Sync] Processing sync batch with ${items.length} items...`);

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

        if (entityType === 'patient') {
          const regDate = parseSafeDate(payload.registrationDate, new Date()) || new Date();
          const lastMod = parseSafeDate(payload.lastModified, new Date()) || new Date();

          const patientDisplayId = payload.patientId || payload.displayId || `RC-${(payload.id || entityId).slice(0, 8)}`;
          const villageName = payload.village || payload.villageZone || 'Ramgarh Sector';

          await prisma.patient.upsert({
            where: { id: payload.id || entityId },
            update: {
              patientId: patientDisplayId,
              fullName: payload.fullName,
              age: Number(payload.age) || 0,
              gender: payload.gender || 'Other',
              village: villageName,
              contactNumber: payload.contactNumber || '',
              chwAssigned: payload.chwAssigned || 'Sarah Jenkins',
              notes: payload.notes || '',
              syncStatus: 'synced',
              version: Number(payload.version) || 1,
              lastModified: lastMod,
            },
            create: {
              id: payload.id || entityId,
              patientId: patientDisplayId,
              fullName: payload.fullName,
              age: Number(payload.age) || 0,
              gender: payload.gender || 'Other',
              village: villageName,
              contactNumber: payload.contactNumber || '',
              chwAssigned: payload.chwAssigned || 'Sarah Jenkins',
              registrationDate: regDate,
              notes: payload.notes || '',
              syncStatus: 'synced',
              version: Number(payload.version) || 1,
              lastModified: lastMod,
            },
          });

          await prisma.syncAuditLog.create({
            data: {
              entityType: 'patient',
              entityId: payload.id || entityId,
              operationType: operationType || 'CREATE',
              payload: payload,
              status: 'synced',
              clientTimestamp: parseSafeDate(item.createdAt, new Date()),
            },
          });

          processedIds.push(item.id);
        } else if (entityType === 'followup') {
          const visitDate = parseSafeDate(payload.visitDate, new Date()) || new Date();
          const nextDate = payload.nextFollowUpDate ? parseSafeDate(payload.nextFollowUpDate, null) : null;
          const lastMod = parseSafeDate(payload.lastModified, new Date()) || new Date();

          // Ensure parent patient exists in PostgreSQL
          const parentPatient = await prisma.patient.findUnique({
            where: { id: payload.patientId },
          });

          if (!parentPatient) {
            console.warn(`[Sync] Parent patient ${payload.patientId} not found yet for follow-up ${entityId}.`);
          }

          await prisma.followUp.upsert({
            where: { id: payload.id || entityId },
            update: {
              patientId: payload.patientId,
              patientDisplayId: payload.patientDisplayId || 'RC-FIELD',
              patientName: payload.patientName,
              visitDate: visitDate,
              category: payload.category,
              observations: payload.observations,
              notes: payload.notes || '',
              nextFollowUpDate: nextDate,
              status: payload.status || 'completed',
              chwName: payload.chwName || 'Sarah Jenkins',
              syncStatus: 'synced',
              version: Number(payload.version) || 1,
              lastModified: lastMod,
            },
            create: {
              id: payload.id || entityId,
              patientId: payload.patientId,
              patientDisplayId: payload.patientDisplayId || 'RC-FIELD',
              patientName: payload.patientName,
              visitDate: visitDate,
              category: payload.category,
              observations: payload.observations,
              notes: payload.notes || '',
              nextFollowUpDate: nextDate,
              status: payload.status || 'completed',
              chwName: payload.chwName || 'Sarah Jenkins',
              syncStatus: 'synced',
              version: Number(payload.version) || 1,
              lastModified: lastMod,
            },
          });

          await prisma.syncAuditLog.create({
            data: {
              entityType: 'followup',
              entityId: payload.id || entityId,
              operationType: operationType || 'CREATE',
              payload: payload,
              status: 'synced',
              clientTimestamp: parseSafeDate(item.createdAt, new Date()),
            },
          });

          processedIds.push(item.id);
        } else if (entityType === 'task') {
          const dueDate = parseSafeDate(payload.dueDate, new Date()) || new Date();
          const completedAt = payload.completedAt ? parseSafeDate(payload.completedAt, null) : null;
          const lastMod = parseSafeDate(payload.lastModified, new Date()) || new Date();

          // Validate patientId relation if specified
          let validPatientId: string | null = null;
          if (payload.patientId) {
            const exists = await prisma.patient.findUnique({ where: { id: payload.patientId } });
            if (exists) validPatientId = payload.patientId;
          }

          await prisma.task.upsert({
            where: { id: payload.id || entityId },
            update: {
              title: payload.title,
              patientId: validPatientId,
              patientName: payload.patientName || null,
              dueDate: dueDate,
              priority: payload.priority || 'medium',
              completed: Boolean(payload.completed),
              completedAt: completedAt,
              assignedChw: payload.assignedChw || 'Sarah Jenkins',
              category: payload.category || 'Administrative',
              syncStatus: 'synced',
              version: Number(payload.version) || 1,
              lastModified: lastMod,
            },
            create: {
              id: payload.id || entityId,
              title: payload.title,
              patientId: validPatientId,
              patientName: payload.patientName || null,
              dueDate: dueDate,
              priority: payload.priority || 'medium',
              completed: Boolean(payload.completed),
              completedAt: completedAt,
              assignedChw: payload.assignedChw || 'Sarah Jenkins',
              category: payload.category || 'Administrative',
              syncStatus: 'synced',
              version: Number(payload.version) || 1,
              lastModified: lastMod,
            },
          });

          await prisma.syncAuditLog.create({
            data: {
              entityType: 'task',
              entityId: payload.id || entityId,
              operationType: operationType || 'CREATE',
              payload: payload,
              status: 'synced',
              clientTimestamp: parseSafeDate(item.createdAt, new Date()),
            },
          });

          processedIds.push(item.id);
        }
      } catch (itemError: any) {
        console.error(`[Sync] Error syncing item ${item.id}:`, itemError);
        failedItems.push({
          id: item.id,
          error: itemError.message || 'Unknown database error',
        });
      }
    }

    console.log(`[Sync] Sync complete. ${processedIds.length} succeeded, ${failedItems.length} failed.`);

    return res.json({
      success: true,
      processedIds,
      failedItems,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Sync] Fatal sync endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing synchronization batch',
    });
  }
});

// Query endpoints for dashboard and audit
app.get('/api/patients', async (_req: Request, res: Response) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { registrationDate: 'desc' },
      include: { followUps: true, tasks: true },
    });
    res.json({ success: true, count: patients.length, data: patients });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/follow-ups', async (_req: Request, res: Response) => {
  try {
    const followUps = await prisma.followUp.findMany({
      orderBy: { visitDate: 'desc' },
    });
    res.json({ success: true, count: followUps.length, data: followUps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tasks', async (_req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { dueDate: 'asc' },
    });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express server
const PORT = env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 RuralCare Connect API Server running at http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth Endpoints: http://localhost:${PORT}/api/auth/login`);
  console.log(`🔄 Sync Endpoint: http://localhost:${PORT}/api/sync`);
  await ensureDefaultAccounts();
});

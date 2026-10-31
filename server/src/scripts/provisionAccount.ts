import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { provisionUserSchema } from '../validation/schemas';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error('============================================================');
  console.error('[Error] DATABASE_URL must be provided at execution time.');
  console.error('============================================================');
  console.error('For security and precision, supply the target database URL:');
  console.error('  $env:DATABASE_URL="postgresql://user:password@host/db"');
  console.error('  $env:CHW_EMAIL="sarah.jenkins@ruralcare.org"');
  console.error('  $env:CHW_PASSWORD="YourStrongPassword"');
  console.error('  npm run provision:account');
  console.error('============================================================');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

async function main() {
  const rawEmail = (process.env.ADMIN_EMAIL || process.env.CHW_EMAIL || process.argv[2] || '').trim().toLowerCase();
  const rawPassword = process.env.ADMIN_PASSWORD || process.env.CHW_PASSWORD || process.argv[3] || '';
  const rawName = process.env.ADMIN_NAME || process.env.CHW_NAME || process.argv[4] || (rawEmail === 'sarah.jenkins@ruralcare.org' ? 'Sarah Jenkins' : 'Community Health Worker');
  const rawRole = process.env.ADMIN_ROLE || process.env.CHW_ROLE || process.argv[5] || 'Community Health Worker';
  const rawZone = process.env.ADMIN_ZONE || process.env.CHW_ZONE || process.argv[6] || (rawEmail === 'sarah.jenkins@ruralcare.org' ? 'Ramgarh Health Sector' : 'General Health Sector');
  const rawPhone = process.env.ADMIN_PHONE || process.env.CHW_PHONE || process.argv[7] || (rawEmail === 'sarah.jenkins@ruralcare.org' ? '+91 98765 43210' : '');

  const validation = provisionUserSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
    name: rawName,
    role: rawRole,
    villageZone: rawZone,
    phoneNumber: rawPhone,
  });

  if (!validation.success) {
    console.error('============================================================');
    console.error('[Error] Invalid provisioning parameters:');
    for (const issue of validation.error.issues) {
      console.error(` - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('============================================================');
    process.exit(1);
  }

  const { email, password, name, role, villageZone, phoneNumber } = validation.data;

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, name: true },
    });

    if (existing) {
      console.log('============================================================');
      console.log(`[Idempotent] Account "${email}" already exists in target database.`);
      console.log(`Role: ${existing.role}`);
      console.log(`Name: ${existing.name}`);
      console.log('No modifications made. Existing account was safely preserved.');
      console.log('============================================================');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        villageZone,
        phoneNumber,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        villageZone: true,
        createdAt: true,
      },
    });

    console.log('============================================================');
    console.log('✅ PRODUCTION ACCOUNT PROVISIONED SUCCESSFULLY');
    console.log('============================================================');
    console.log(`Account Email:  ${user.email}`);
    console.log(`Assigned Name:  ${user.name}`);
    console.log(`Role:           ${user.role}`);
    console.log(`Village Sector: ${user.villageZone}`);
    console.log(`Account ID:     ${user.id}`);
    console.log(`Created At:     ${user.createdAt.toISOString()}`);
    console.log('============================================================');
  } catch (err) {
    console.error('[Error] Failed to provision account in target database.');
    console.error(err instanceof Error ? err.message : 'Unknown database error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

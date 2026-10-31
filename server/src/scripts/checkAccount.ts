import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL?.trim();
const prisma = new PrismaClient(
  databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined
);

async function main() {
  const email = (process.argv[2] || process.env.CHECK_EMAIL || 'sarah.jenkins@ruralcare.org').trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        villageZone: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const totalUsers = await prisma.user.count();

    console.log('============================================================');
    console.log('🔍 RURALCARE CONNECT — ACCOUNT STATUS INSPECTION');
    console.log('============================================================');
    console.log(`Target Email:               ${email}`);
    console.log(`Total Accounts in Database: ${totalUsers}`);

    if (!user) {
      console.log(`Account Status:             DOES NOT EXIST (Missing in database)`);
      console.log('============================================================');
      return;
    }

    console.log(`Account Status:             EXISTS (Active)`);
    console.log(`Name:                       ${user.name}`);
    console.log(`Role:                       ${user.role}`);
    console.log(`Village Sector:             ${user.villageZone}`);
    console.log(`Created At:                 ${user.createdAt.toISOString()}`);
    console.log(`Last Updated:               ${user.updatedAt.toISOString()}`);
    console.log('============================================================');
  } catch (err) {
    console.error('Database connection error:', err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

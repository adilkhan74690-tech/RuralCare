import http from 'http';
import { app } from '../server';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

let server: http.Server;
let port: number;
let baseUrl: string;

let sarahToken: string;
let anitaToken: string;
let supervisorToken: string;
let sarahPatientId: string;
let anitaPatientId: string;

async function setup() {
  server = app.listen(0);
  port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}/api`;

  // Clear emergency incidents and test patients
  await prisma.syncAuditLog.deleteMany({ where: { entityType: 'emergency' } });
  await prisma.emergencyIncident.deleteMany({});
  await prisma.patient.deleteMany({
    where: {
      patientId: { in: ['RC-EMG-SARAH-01', 'RC-EMG-ANITA-01'] },
    },
  });

  const pHash = await bcrypt.hash('Password@123', 10);
  const sHash = await bcrypt.hash('Admin@123', 10);

  // Ensure Sarah, Anita, Supervisor exist
  const sarah = await prisma.user.upsert({
    where: { email: 'sarah.jenkins@ruralcare.org' },
    update: {},
    create: {
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@ruralcare.org',
      passwordHash: pHash,
      role: 'Community Health Worker',
      villageZone: 'Ramgarh Health Sector',
      phoneNumber: '+91 98765 43210',
    },
  });

  const anita = await prisma.user.upsert({
    where: { email: 'anita.murmu@ruralcare.org' },
    update: {},
    create: {
      name: 'Anita Murmu',
      email: 'anita.murmu@ruralcare.org',
      passwordHash: pHash,
      role: 'Community Health Worker',
      villageZone: 'Chandrapura Sector',
      phoneNumber: '+91 98765 11223',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'admin@ruralcare.org' },
    update: {},
    create: {
      name: 'Dr. Alok Verma',
      email: 'admin@ruralcare.org',
      passwordHash: sHash,
      role: 'Healthcare Supervisor',
      villageZone: 'District Headquarters',
      phoneNumber: '+91 98765 00001',
    },
  });

  sarahToken = jwt.sign(
    { id: sarah.id, email: sarah.email, name: sarah.name, role: sarah.role, villageZone: sarah.villageZone },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  anitaToken = jwt.sign(
    { id: anita.id, email: anita.email, name: anita.name, role: anita.role, villageZone: anita.villageZone },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  supervisorToken = jwt.sign(
    { id: supervisor.id, email: supervisor.email, name: supervisor.name, role: supervisor.role, villageZone: supervisor.villageZone },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Create patients for Sarah and Anita
  const sp = await prisma.patient.create({
    data: {
      patientId: 'RC-EMG-SARAH-01',
      fullName: 'Pooja Devi',
      age: 26,
      gender: 'Female',
      village: 'Ramgarh Basti',
      contactNumber: '+91 98765 44332',
      chwAssigned: 'Sarah Jenkins',
      syncStatus: 'synced',
    },
  });
  sarahPatientId = sp.id;

  const ap = await prisma.patient.create({
    data: {
      patientId: 'RC-EMG-ANITA-01',
      fullName: 'Ramesh Tudu',
      age: 45,
      gender: 'Male',
      village: 'Chandrapura',
      contactNumber: '+91 98765 88990',
      chwAssigned: 'Anita Murmu',
      syncStatus: 'synced',
    },
  });
  anitaPatientId = ap.id;
}

async function runTests() {
  console.log('============================================================');
  console.log('🚨 RURALCARE CONNECT — SOS EMERGENCY SYSTEM VERIFICATION');
  console.log('============================================================\n');

  await setup();

  let createdIncidentId = '';

  // 1. Create Emergency Incident for Registered Patient
  console.log('  ⏳ Test 1: CHW Sarah creates an emergency incident for registered patient Pooja Devi...');
  const res1 = await fetch(`${baseUrl}/emergencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sarahToken}` },
    body: JSON.stringify({
      patientId: sarahPatientId,
      patientName: 'Pooja Devi',
      patientDisplayId: 'RC-EMG-SARAH-01',
      category: 'Maternal / Obstetric Emergency',
      priority: 'critical',
      notes: 'Severe postpartum bleeding observed in field visit.',
      workerLatitude: 23.634,
      workerLongitude: 85.512,
      locationType: 'same_as_worker',
      village: 'Ramgarh Basti',
    }),
  });

  const data1: any = await res1.json();
  if (!res1.ok || !data1.success || !data1.data?.id) {
    throw new Error(`Test 1 Failed: ${JSON.stringify(data1)}`);
  }
  createdIncidentId = data1.data.id;
  console.log(`✅ PASSED (Incident Code: ${data1.data.incidentCode})\n`);

  // 2. Create Unregistered Emergency Incident
  console.log('  ⏳ Test 2: CHW Sarah registers an emergency for an unregistered trauma victim...');
  const res2 = await fetch(`${baseUrl}/emergencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sarahToken}` },
    body: JSON.stringify({
      isUnregistered: true,
      patientName: 'Unknown Roadside Accident Victim',
      unregisteredPatientAge: 32,
      unregisteredGender: 'Male',
      category: 'Severe Trauma / Accident',
      priority: 'critical',
      notes: 'Head injury on NH 33, unconscious.',
      workerLatitude: 23.634,
      workerLongitude: 85.512,
      patientLatitude: 23.640,
      patientLongitude: 85.520,
      locationType: 'different',
      manualAddress: 'Near Ramgarh Toll Plaza, NH 33',
    }),
  });

  const data2: any = await res2.json();
  if (!res2.ok || !data2.success || !data2.data?.id) {
    throw new Error(`Test 2 Failed: ${JSON.stringify(data2)}`);
  }
  console.log(`✅ PASSED (Unregistered Incident Code: ${data2.data.incidentCode})\n`);

  // 3. IDOR Protection: Anita attempting to log emergency for Sarah's patient is rejected
  console.log('  ⏳ Test 3: CHW Anita attempting to register emergency for Sarah\'s patient is rejected (403)...');
  const res3 = await fetch(`${baseUrl}/emergencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anitaToken}` },
    body: JSON.stringify({
      patientId: sarahPatientId,
      patientName: 'Pooja Devi',
      category: 'Severe Dehydration / Shock',
      priority: 'urgent',
    }),
  });
  if (res3.status !== 403) {
    throw new Error(`Test 3 Failed: expected 403 Forbidden, got ${res3.status}`);
  }
  console.log('✅ PASSED (Forbidden 403 confirmed)\n');

  // 4. Query emergencies scoped to CHW
  console.log('  ⏳ Test 4: Sarah queries GET /api/emergencies (receives only her 2 incidents)...');
  const res4 = await fetch(`${baseUrl}/emergencies`, {
    headers: { Authorization: `Bearer ${sarahToken}` },
  });
  const data4: any = await res4.json();
  if (!res4.ok || data4.count !== 2) {
    throw new Error(`Test 4 Failed: expected 2 incidents, got ${data4.count}`);
  }
  console.log('✅ PASSED\n');

  // 5. Query emergencies by Supervisor (sees all incidents)
  console.log('  ⏳ Test 5: Supervisor Dr. Alok Verma queries GET /api/emergencies (sees all incidents)...');
  const res5 = await fetch(`${baseUrl}/emergencies`, {
    headers: { Authorization: `Bearer ${supervisorToken}` },
  });
  const data5: any = await res5.json();
  if (!res5.ok || data5.count < 2) {
    throw new Error(`Test 5 Failed: expected >= 2 incidents, got ${data5.count}`);
  }
  console.log('✅ PASSED\n');

  // 6. Update Emergency with Hospital Referral, Contact Attempt, and Transport (Phase 3 Workflow)
  console.log('  ⏳ Test 6: Sarah updates incident with CHC referral, contact attempt and 108 ambulance dispatch...');
  const res6 = await fetch(`${baseUrl}/emergencies/${createdIncidentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sarahToken}` },
    body: JSON.stringify({
      referralStatus: 'transport_arranged',
      facilityId: 'hosp-gov-ramgarh-sdh',
      facilityName: 'Sub-Divisional Hospital Ramgarh',
      facilityType: 'District Hospital / SDH',
      facilityPhone: '+91 6553 222108',
      facilityDistanceKm: 4.8,
      contactAttempts: [
        {
          timestamp: new Date().toISOString(),
          recipient: 'Emergency Medical Officer',
          phone: '+91 6553 222108',
          outcome: 'Reached - Bed Confirmed',
          notes: 'Spoke with Dr. Sinha. Emergency OT on alert.',
        },
      ],
      transportType: '108 Emergency Ambulance',
      transportContact: '+91 98765 99108 (Driver Rajesh)',
      transportNotes: '108 dispatch confirmed by district control room',
      dispatchConfirmed: true,
      referralCode: 'REF-2026-98124',
    }),
  });

  const data6: any = await res6.json();
  if (!res6.ok || data6.data?.referralStatus !== 'transport_arranged' || !data6.data?.dispatchConfirmed) {
    throw new Error(`Test 6 Failed: ${JSON.stringify(data6)}`);
  }
  console.log('✅ PASSED (Referral updated successfully)\n');

  // 7. Test Automatic Batch Sync with Emergency entityType
  console.log('  ⏳ Test 7: Batch /api/sync endpoint processes offline-created emergency incident...');
  const offlineEmgId = `emg-offline-${Date.now()}`;
  const res7 = await fetch(`${baseUrl}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sarahToken}` },
    body: JSON.stringify({
      items: [
        {
          id: `queue-${Date.now()}`,
          entityId: offlineEmgId,
          entityType: 'emergency',
          operationType: 'CREATE',
          payload: {
            id: offlineEmgId,
            incidentCode: 'EMG-2026-OFF01',
            patientId: sarahPatientId,
            patientName: 'Pooja Devi',
            patientDisplayId: 'RC-EMG-SARAH-01',
            category: 'Acute Cardiac / Chest Pain',
            priority: 'critical',
            notes: 'Created offline during village round with no cellular network.',
            referralStatus: 'initiated',
            version: 1,
          },
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  });

  const data7: any = await res7.json();
  if (!res7.ok || !data7.success || data7.processedIds.length !== 1) {
    throw new Error(`Test 7 Failed: ${JSON.stringify(data7)}`);
  }

  // Verify in PostgreSQL
  const persisted = await prisma.emergencyIncident.findUnique({ where: { id: offlineEmgId } });
  if (!persisted || persisted.incidentCode !== 'EMG-2026-OFF01') {
    throw new Error('Test 7 Failed: Offline incident not persisted in PostgreSQL.');
  }
  console.log('✅ PASSED (Batch sync processed emergency record seamlessly)\n');

  // Clean up
  server.close();
  console.log('============================================================');
  console.log('🎉 ALL SOS EMERGENCY SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});


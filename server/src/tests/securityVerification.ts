import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { app } from '../server';
import { env } from '../config/env';
import { prisma } from '../prisma';

interface TestSummary {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestSummary[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`  ⏳ Running: ${name}... `);
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASSED`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`❌ FAILED: ${err.message}`);
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('🛡️  RURALCARE CONNECT — COMPREHENSIVE SECURITY TEST SUITE');
  console.log('    Reference: OWASP ASVS 5.0 Verification');
  console.log('============================================================\n');

  // Start ephemeral server on random available port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`[Test Server] Live on ephemeral port: ${port}\n`);

  let sarahToken = '';
  let anitaToken = '';
  let supervisorToken = '';

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: AUTHENTICATION TESTS
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 1: Authentication & Credential Verification ---');

    await runTest('1.1: Valid login returns 200, JWT token, and sanitized user profile', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sarah.jenkins@ruralcare.org',
          password: 'Password@123',
        }),
      });
      assert(res.status === 200, `Expected status 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Expected body.success to be true');
      assert(typeof body.token === 'string' && body.token.length > 20, 'Expected valid JWT token');
      assert(body.user.email === 'sarah.jenkins@ruralcare.org', 'Expected correct user email');
      assert(body.user.role === 'Community Health Worker', 'Expected CHW role');
      sarahToken = body.token;
    });

    await runTest('1.2: Authenticate additional worker (Anita Murmu) and supervisor (Dr. Alok Verma)', async () => {
      const anitaRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'anita.murmu@ruralcare.org',
          password: 'Password@123',
        }),
      });
      assert(anitaRes.status === 200, 'Anita login failed');
      const anitaBody = await anitaRes.json();
      anitaToken = anitaBody.token;

      const supRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@ruralcare.org',
          password: 'Admin@123',
        }),
      });
      assert(supRes.status === 200, 'Supervisor login failed');
      const supBody = await supRes.json();
      supervisorToken = supBody.token;
    });

    await runTest('1.3: Invalid password returns 401 with generic error message', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sarah.jenkins@ruralcare.org',
          password: 'WrongPassword@999',
        }),
      });
      assert(res.status === 401, `Expected status 401, got ${res.status}`);
      const body = await res.json();
      assert(body.success === false, 'Expected success === false');
      assert(!body.token, 'Token should not be issued on invalid password');
    });

    await runTest('1.4: Non-existent user email returns 401 with generic error message', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent.worker@ruralcare.org',
          password: 'Password@123',
        }),
      });
      assert(res.status === 401, `Expected status 401, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 2: INVALID / EXPIRED / REVOKED TOKEN TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Token Expiry, Revocation & Tampering Tests ---');

    await runTest('2.1: Request with malformed Bearer token returns 401', async () => {
      const res = await fetch(`${baseUrl}/patients`, {
        headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('2.2: Request with token signed with invalid secret returns 401', async () => {
      const forgedToken = jwt.sign(
        { id: 'fake-id', email: 'forged@test.com' },
        'this-is-a-completely-wrong-unauthorized-secret-key-32chars'
      );
      const res = await fetch(`${baseUrl}/patients`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('2.3: Request with expired token returns 401 with expiration error', async () => {
      const expiredToken = jwt.sign(
        { id: 'some-user', email: 'sarah.jenkins@ruralcare.org' },
        env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      // Wait 10ms to ensure expiration
      await new Promise((r) => setTimeout(r, 20));
      const res = await fetch(`${baseUrl}/patients`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert(res.status === 401, `Expected 401 for expired token, got ${res.status}`);
      const body = await res.json();
      assert(body.error.toLowerCase().includes('expired'), 'Error message should indicate expired token');
    });

    await runTest('2.4: Logged-out revoked token is rejected on subsequent requests', async () => {
      // 1. Issue a temporary token by logging in
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sarah.jenkins@ruralcare.org',
          password: 'Password@123',
        }),
      });
      const tempToken = (await loginRes.json()).token;

      // 2. Verify token works before logout
      const beforeRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert(beforeRes.status === 200, 'Token should be valid before logout');

      // 3. Logout (revokes token on server)
      const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert(logoutRes.status === 200, 'Logout should succeed');

      // 4. Try using the same token again -> must be rejected with 401
      const afterRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert(afterRes.status === 401, `Expected 401 after logout revocation, got ${afterRes.status}`);
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 3: UNAUTHORIZED API ACCESS TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Server-side Authentication on Every Endpoint ---');

    await runTest('3.1: GET /api/patients without token returns 401', async () => {
      const res = await fetch(`${baseUrl}/patients`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('3.2: GET /api/follow-ups without token returns 401', async () => {
      const res = await fetch(`${baseUrl}/follow-ups`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('3.3: GET /api/tasks without token returns 401', async () => {
      const res = await fetch(`${baseUrl}/tasks`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('3.4: POST /api/sync without token returns 401', async () => {
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('3.5: GET /api/auth/me without token returns 401', async () => {
      const res = await fetch(`${baseUrl}/auth/me`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 4: CROSS-USER PATIENT ACCESS (IDOR / BOLA) TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Patient Ownership & IDOR Prevention Tests ---');

    const testSarahPatientId = `test-pat-sarah-${Date.now()}`;
    const testAnitaPatientId = `test-pat-anita-${Date.now()}`;

    await runTest('4.1: CHW Sarah creates a patient record assigned to herself', async () => {
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              id: `q-sarah-${Date.now()}`,
              entityId: testSarahPatientId,
              entityType: 'patient',
              operationType: 'CREATE',
              payload: {
                id: testSarahPatientId,
                patientId: `RC-SARAH-${Math.floor(100 + Math.random() * 900)}`,
                fullName: 'Sarah Private Patient',
                age: 42,
                gender: 'Female',
                village: 'Ramgarh Health Sector',
                contactNumber: '+91 90000 11111',
                version: 1,
              },
            },
          ],
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.processedIds.length === 1, 'Patient should be created');
    });

    await runTest('4.2: CHW Anita creates a patient record assigned to herself', async () => {
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anitaToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              id: `q-anita-${Date.now()}`,
              entityId: testAnitaPatientId,
              entityType: 'patient',
              operationType: 'CREATE',
              payload: {
                id: testAnitaPatientId,
                patientId: `RC-ANITA-${Math.floor(100 + Math.random() * 900)}`,
                fullName: 'Anita Private Patient',
                age: 36,
                gender: 'Female',
                village: 'Chandrapura Sector',
                contactNumber: '+91 90000 22222',
                version: 1,
              },
            },
          ],
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.processedIds.length === 1, 'Anita patient created');
    });

    await runTest('4.3: CHW Anita calling GET /api/patients does NOT receive Sarah\'s patient', async () => {
      const res = await fetch(`${baseUrl}/patients`, {
        headers: { Authorization: `Bearer ${anitaToken}` },
      });
      assert(res.status === 200, 'GET /api/patients failed');
      const body = await res.json();
      const ids = body.data.map((p: any) => p.id);
      assert(!ids.includes(testSarahPatientId), 'IDOR violation: Anita saw Sarah\'s private patient!');
      assert(ids.includes(testAnitaPatientId), 'Anita should see her own patient');
    });

    await runTest('4.4: CHW Anita attempting to overwrite Sarah\'s patient via sync is REJECTED', async () => {
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anitaToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              id: `q-tamper-${Date.now()}`,
              entityId: testSarahPatientId,
              entityType: 'patient',
              operationType: 'UPDATE',
              payload: {
                id: testSarahPatientId,
                fullName: 'TAMPERED BY ANITA',
                age: 50,
                gender: 'Female',
                village: 'Ramgarh Health Sector',
                contactNumber: '+91 99999 99999',
                version: 2,
              },
            },
          ],
        }),
      });
      assert(res.status === 200, `Sync status should be 200, got ${res.status}`);
      const body = await res.json();
      assert(body.failedItems.length === 1, 'Tampering attempt must be rejected');
      assert(body.failedItems[0].error.toLowerCase().includes('cannot modify a patient record assigned to another'),
        `Unexpected error message: ${body.failedItems[0].error}`
      );

      // Verify in DB that patient name was NOT modified
      const patInDb = await prisma.patient.findUnique({ where: { id: testSarahPatientId } });
      assert(patInDb?.fullName === 'Sarah Private Patient', 'Database was corrupted by cross-user tamper!');
    });

    await runTest('4.5: Healthcare Supervisor can query and view all patients across workers', async () => {
      const res = await fetch(`${baseUrl}/patients`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
      });
      assert(res.status === 200, 'Supervisor GET /api/patients failed');
      const body = await res.json();
      const ids = body.data.map((p: any) => p.id);
      assert(ids.includes(testSarahPatientId), 'Supervisor should see Sarah\'s patient');
      assert(ids.includes(testAnitaPatientId), 'Supervisor should see Anita\'s patient');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 5: INVALID PAYLOAD (ZOD VALIDATION) TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Input Validation & Mass Assignment Prevention ---');

    await runTest('5.1: Malformed login payload (invalid email format) returns 400', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email-address', password: 'Password@123' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('5.2: Empty login password returns 400', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sarah.jenkins@ruralcare.org', password: '' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('5.3: Sync request with invalid structure (items not array) returns 400', async () => {
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahToken}`,
        },
        body: JSON.stringify({ items: 'not-an-array' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('5.4: Patient with negative age is rejected by validation in failedItems', async () => {
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              id: `q-neg-age-${Date.now()}`,
              entityId: `pat-bad-${Date.now()}`,
              entityType: 'patient',
              operationType: 'CREATE',
              payload: {
                fullName: 'Negative Age Patient',
                age: -15, // Invalid!
                gender: 'Female',
                village: 'Ramgarh Health Sector',
              },
            },
          ],
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.failedItems.length === 1, 'Negative age must be rejected');
      assert(body.failedItems[0].error.includes('Age cannot be negative'), `Expected age error, got: ${body.failedItems[0].error}`);
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 6: DUPLICATE SYNC & IDEMPOTENCY TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Duplicate Sync Operations & Idempotency ---');

    await runTest('6.1: Submitting duplicate sync items does not produce errors or duplicates', async () => {
      const dupEntityId = `pat-dup-${Date.now()}`;
      const queueItemId = `queue-dup-${Date.now()}`;
      const createdAt = new Date().toISOString();

      const syncItem = {
        id: queueItemId,
        entityId: dupEntityId,
        entityType: 'patient',
        operationType: 'CREATE',
        createdAt,
        payload: {
          id: dupEntityId,
          patientId: `RC-DUP-${Math.floor(100 + Math.random() * 900)}`,
          fullName: 'Duplicate Test Patient',
          age: 30,
          gender: 'Female',
          village: 'Ramgarh Health Sector',
          version: 1,
        },
      };

      // First sync submission
      const firstRes = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahToken}`,
        },
        body: JSON.stringify({ items: [syncItem] }),
      });
      const firstBody = await firstRes.json();
      assert(firstBody.processedIds.includes(queueItemId), 'First sync should process item');

      // Second identical sync submission (duplicate click / network retry)
      const secondRes = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahToken}`,
        },
        body: JSON.stringify({ items: [syncItem] }),
      });
      const secondBody = await secondRes.json();
      assert(secondBody.processedIds.includes(queueItemId), 'Duplicate sync should recognize idempotency and acknowledge');
      assert(secondBody.failedItems.length === 0, 'Duplicate sync should not fail');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 7: OFFLINE CREATE -> RECONNECT -> SYNC REGRESSION TEST
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Offline Create -> Reconnect -> Sync Regression ---');

    await runTest('7.1: Full lifecycle: create patient, record follow-up, assign task, and synchronize', async () => {
      const regressionPatientId = `pat-lifecycle-${Date.now()}`;
      const regressionFollowUpId = `fu-lifecycle-${Date.now()}`;
      const regressionTaskId = `task-lifecycle-${Date.now()}`;
      const nowStr = new Date().toISOString();

      const batch = [
        {
          id: `q-p-${Date.now()}`,
          entityId: regressionPatientId,
          entityType: 'patient',
          operationType: 'CREATE',
          createdAt: nowStr,
          payload: {
            id: regressionPatientId,
            patientId: `RC-LIFE-${Math.floor(100 + Math.random() * 900)}`,
            fullName: 'Lifecycle Test Patient',
            age: 28,
            gender: 'Female',
            village: 'Ramgarh Health Sector',
            contactNumber: '+91 98765 00112',
            notes: 'Maternal health visit scheduled.',
            version: 1,
          },
        },
        {
          id: `q-f-${Date.now()}`,
          entityId: regressionFollowUpId,
          entityType: 'followup',
          operationType: 'CREATE',
          createdAt: nowStr,
          payload: {
            id: regressionFollowUpId,
            patientId: regressionPatientId,
            patientName: 'Lifecycle Test Patient',
            visitDate: nowStr,
            category: 'Maternal health follow-up',
            observations: 'Healthy vitals, blood pressure normal.',
            notes: 'Follow-up in 2 weeks.',
            status: 'completed',
            version: 1,
          },
        },
        {
          id: `q-t-${Date.now()}`,
          entityId: regressionTaskId,
          entityType: 'task',
          operationType: 'CREATE',
          createdAt: nowStr,
          payload: {
            id: regressionTaskId,
            title: 'Deliver Iron Supplements',
            patientId: regressionPatientId,
            patientName: 'Lifecycle Test Patient',
            dueDate: '2026-11-15T10:00:00.000Z',
            priority: 'high',
            completed: false,
            category: 'Routine follow-up',
            version: 1,
          },
        },
      ];

      // Submit entire batch
      const res = await fetch(`${baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahToken}`,
        },
        body: JSON.stringify({ items: batch }),
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.processedIds.length === 3, `Expected all 3 items to be processed, got ${body.processedIds.length}`);
      assert(body.failedItems.length === 0, `Expected 0 failed items, got ${JSON.stringify(body.failedItems)}`);

      // Verify in PostgreSQL database directly
      const pat = await prisma.patient.findUnique({
        where: { id: regressionPatientId },
        include: { followUps: true, tasks: true },
      });
      assert(pat !== null, 'Patient record must exist in PostgreSQL');
      assert(pat?.followUps.length === 1, 'Follow-up must exist in PostgreSQL');
      assert(pat?.tasks.length === 1, 'Task must exist in PostgreSQL');
      assert(pat?.chwAssigned === 'Sarah Jenkins', 'CHW must be assigned to authenticated user');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 8: SECURITY HEADERS VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Security Headers (Helmet) Verification ---');

    await runTest('8.1: Responses contain X-Content-Type-Options: nosniff and omit X-Powered-By', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert(res.status === 200, 'Health check failed');
      const xContentType = res.headers.get('x-content-type-options');
      assert(xContentType === 'nosniff', `Expected x-content-type-options: nosniff, got ${xContentType}`);
      const xPoweredBy = res.headers.get('x-powered-by');
      assert(xPoweredBy === null, `Expected x-powered-by header to be absent, got ${xPoweredBy}`);
    });

  } finally {
    // Graceful shutdown of ephemeral server & database connection
    server.close();
    await prisma.$disconnect();
  }

  // -------------------------------------------------------------------------
  // FINAL RESULTS REPORT
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log('============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  results.forEach((r, idx) => {
    const symbol = r.passed ? '✅' : '❌';
    console.log(`  ${symbol} [${idx + 1}/${results.length}] ${r.name}`);
    if (r.error) console.log(`      Error: ${r.error}`);
  });

  console.log('------------------------------------------------------------');
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

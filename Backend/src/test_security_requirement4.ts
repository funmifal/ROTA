import { prisma } from './database/prisma';
import { MembershipRole, MembershipStatus, ShiftStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './config/env';

const BASE_URL = 'http://127.0.0.1:5000';

function generateToken(user: { id: string; email: string; tokenVersion?: number }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
}

async function runSecurityTests() {
  console.log('====================================================');
  console.log(' RUNNING SECURITY REQUIREMENT 4 AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  const timestamp = Date.now();

  // 1. Setup Test Tenants and Users
  console.log('[Setup] Creating Tenant A and Tenant B...');

  // User 1: Owner of Business A
  const userOwnerA = await prisma.user.create({
    data: {
      name: 'Owner Alice',
      email: `owner.alice.${timestamp}@example.com`,
      passwordHash: 'hashed_password_placeholder',
    },
  });

  // User 2: Staff of Business A
  const userStaffA = await prisma.user.create({
    data: {
      name: 'Staff Bob',
      email: `staff.bob.${timestamp}@example.com`,
      passwordHash: 'hashed_password_placeholder',
    },
  });

  // User 3: Owner of Business B
  const userOwnerB = await prisma.user.create({
    data: {
      name: 'Owner Charlie',
      email: `owner.charlie.${timestamp}@example.com`,
      passwordHash: 'hashed_password_placeholder',
    },
  });

  // Business A
  const businessA = await prisma.business.create({
    data: {
      name: `Team A Corporation ${timestamp}`,
      timezone: 'Africa/Lagos',
    },
  });

  // Business B
  const businessB = await prisma.business.create({
    data: {
      name: `Team B Enterprises ${timestamp}`,
      timezone: 'Europe/London',
    },
  });

  // Memberships for Business A
  await prisma.membership.create({
    data: {
      businessId: businessA.id,
      userId: userOwnerA.id,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.membership.create({
    data: {
      businessId: businessA.id,
      userId: userStaffA.id,
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Membership for Business B
  await prisma.membership.create({
    data: {
      businessId: businessB.id,
      userId: userOwnerB.id,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Create a Shift in Business A
  const shiftA = await prisma.shift.create({
    data: {
      businessId: businessA.id,
      title: 'Morning Shift A',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 86400000 + 28800000),
      status: ShiftStatus.PUBLISHED,
    },
  });

  // Create a Shift in Business B
  const shiftB = await prisma.shift.create({
    data: {
      businessId: businessB.id,
      title: 'Confidential Shift B',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 86400000 + 28800000),
      status: ShiftStatus.PUBLISHED,
    },
  });

  const tokenOwnerA = generateToken(userOwnerA);
  const tokenStaffA = generateToken(userStaffA);
  const tokenOwnerB = generateToken(userOwnerB);

  console.log('[Setup Complete] Seeded 2 businesses, 3 users, and 2 shifts.\n');

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // TEST 1: Server-side RBAC - Staff calling "delete shift" MUST be rejected with 403 Forbidden
  // ----------------------------------------------------
  console.log('--- TEST 1: Server-side RBAC Enforcement ---');
  try {
    const res = await fetch(`${BASE_URL}/api/businesses/${businessA.id}/shifts/${shiftA.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenStaffA}`,
      },
    });

    const body = await res.json() as any;
    console.log(`Staff delete shift response: Status ${res.status}`, body);

    if (res.status === 403 && body.error === 'Forbidden') {
      console.log('✅ TEST 1A PASSED: Staff user calling "delete shift" endpoint directly was REJECTED with 403 Forbidden.');
      passed++;
    } else {
      console.error('❌ TEST 1A FAILED: Expected 403 Forbidden but received:', res.status, body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 1A ERROR:', err.message);
    failed++;
  }

  // TEST 1B: Owner calling "delete shift" should succeed with 200
  try {
    const res = await fetch(`${BASE_URL}/api/businesses/${businessA.id}/shifts/${shiftA.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
      },
    });

    const body = await res.json() as any;
    console.log(`Owner delete shift response: Status ${res.status}`, body);

    if (res.status === 200 && body.message === 'Shift deleted successfully.') {
      console.log('✅ TEST 1B PASSED: Authorized Owner successfully deleted shift.');
      passed++;
    } else {
      console.error('❌ TEST 1B FAILED: Expected 200 OK but received:', res.status, body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 1B ERROR:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 2: Cross-Tenant Data Isolation - Team A user accessing Team B data MUST be rejected with 403 Forbidden
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Cross-Tenant Data Isolation ---');
  try {
    // User from Business A queries Business B shifts
    const resShifts = await fetch(`${BASE_URL}/api/businesses/${businessB.id}/shifts/upcoming`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`, // Alice is NOT a member of Business B
      },
    });

    const bodyShifts = await resShifts.json() as any;
    console.log(`Cross-tenant shifts query: Status ${resShifts.status}`, bodyShifts);

    // User from Business A queries Business B team members
    const resMembers = await fetch(`${BASE_URL}/api/businesses/${businessB.id}/members`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenOwnerA}`,
      },
    });

    const bodyMembers = await resMembers.json() as any;
    console.log(`Cross-tenant members query: Status ${resMembers.status}`, bodyMembers);

    if (resShifts.status === 403 && resMembers.status === 403 &&
        bodyShifts.error === 'Forbidden' && bodyMembers.error === 'Forbidden') {
      console.log('✅ TEST 2 PASSED: Cross-tenant access strictly blocked with 403 Forbidden on server.');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Expected 403 Forbidden for both cross-tenant queries.');
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 2 ERROR:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 3: Zod Request Body Validation on the server
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Server-side Zod Schema Body Validation ---');
  try {
    // Submitting invalid registration body (invalid email format, password too short)
    const resInvalidReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Input User',
        email: 'not-an-email',
        password: '123',
      }),
    });

    const bodyReg = await resInvalidReg.json() as any;
    console.log(`Invalid registration response: Status ${resInvalidReg.status}`, bodyReg);

    // Submitting invalid invitation body
    const resInvalidInvite = await fetch(`${BASE_URL}/api/businesses/${businessA.id}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        email: 'invalid-email-string',
        role: 'SUPERADMIN', // invalid role
      }),
    });

    const bodyInvite = await resInvalidInvite.json() as any;
    console.log(`Invalid invitation response: Status ${resInvalidInvite.status}`, bodyInvite);

    if (resInvalidReg.status === 400 && bodyReg.error === 'ValidationError' &&
        resInvalidInvite.status === 400 && bodyInvite.error === 'ValidationError') {
      console.log('✅ TEST 3 PASSED: Malformed and invalid request bodies rejected with 400 ValidationError by Zod.');
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED: Expected 400 ValidationError.');
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 3 ERROR:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 4: Rate Limiting with Redis
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Redis Rate Limiting ---');
  try {
    const targetEmail = `ratelimit.test.${timestamp}@example.com`;
    let rateLimited = false;
    let attempts = 0;

    // Login rate limiter is configured for max 5 requests per 15 minutes
    for (let i = 0; i < 8; i++) {
      attempts++;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          password: 'WrongPassword123!',
        }),
      });

      if (res.status === 429) {
        const body = await res.json() as any;
        console.log(`Attempt ${attempts}: Rate limiter triggered HTTP 429 TooManyRequests:`, body);
        rateLimited = true;
        break;
      }
    }

    if (rateLimited) {
      console.log('✅ TEST 4 PASSED: Rate limiter successfully triggered HTTP 429 TooManyRequests.');
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: Rate limit was not triggered within expected attempts.');
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 4 ERROR:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 5: Billing Authorization - Staff calling payment checkout MUST be rejected with 403 Forbidden
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Billing RBAC Authorization ---');
  try {
    const resStaffBilling = await fetch(`${BASE_URL}/api/businesses/${businessA.id}/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        planId: 'STARTER',
        seats: 5,
      }),
    });

    const bodyStaffBilling = await resStaffBilling.json() as any;
    console.log(`Staff billing checkout response: Status ${resStaffBilling.status}`, bodyStaffBilling);

    const resOwnerBilling = await fetch(`${BASE_URL}/api/businesses/${businessA.id}/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        planId: 'STARTER',
        seats: 5,
      }),
    });

    const bodyOwnerBilling = await resOwnerBilling.json() as any;
    console.log(`Owner billing checkout response: Status ${resOwnerBilling.status}`, bodyOwnerBilling);

    if (resStaffBilling.status === 403 && bodyStaffBilling.error === 'Forbidden' &&
        resOwnerBilling.status === 200 && bodyOwnerBilling.checkout?.paymentUrl) {
      console.log('✅ TEST 5 PASSED: Staff strictly blocked from billing checkout (403), Owner authorized (200).');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED: Expected 403 for Staff and 200 for Owner.');
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 5 ERROR:', err.message);
    failed++;
  }


  // ----------------------------------------------------
  // Cleanup Test Data
  // ----------------------------------------------------
  console.log('\n[Teardown] Cleaning up test records...');
  try {
    await prisma.shift.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.membership.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userOwnerA.id, userStaffA.id, userOwnerB.id] } } });
    console.log('[Teardown Complete]');
  } catch (cleanupErr: any) {
    console.warn('[Teardown Warning]:', cleanupErr.message);
  }

  await prisma.$disconnect();

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

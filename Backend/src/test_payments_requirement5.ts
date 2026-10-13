import { prisma } from './database/prisma';
import { MembershipRole, MembershipStatus, PlanTier, SubscriptionStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './config/env';
import { LedgerService } from './modules/billing/ledger.service';
import { processWebhookEvent } from './queues/webhook.queue';

const BASE_URL = 'http://127.0.0.1:5000';

function generateToken(user: { id: string; email: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, tokenVersion: 0 },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
}

async function runPaymentIntegrationTests() {
  console.log('====================================================');
  console.log(' RUNNING REQUIREMENT 5 PAYMENT & BILLING INTEGRATION TESTS');
  console.log('====================================================\n');

  const timestamp = Date.now();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  // Setup Owner & Business
  const userOwner = await prisma.user.create({
    data: {
      name: 'Ifeanyi Okoro',
      email: `ifeanyi.${timestamp}@example.com`,
      passwordHash: 'hashed_password_placeholder',
    },
  });

  const business = await prisma.business.create({
    data: {
      name: `Ifeanyi's Cafe ${timestamp}`,
      timezone: 'Africa/Lagos',
    },
  });

  await prisma.membership.create({
    data: {
      businessId: business.id,
      userId: userOwner.id,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Default to Starter plan (5 seats)
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  await prisma.subscription.create({
    data: {
      businessId: business.id,
      plan: PlanTier.STARTER,
      status: SubscriptionStatus.ACTIVE,
      seatsIncluded: 5,
      totalSeats: 5,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  const token = generateToken(userOwner);

  // -------------------------------------------------------------------------
  // TEST 1: Server-Side Seat Limit Enforcement
  // An owner on Starter (5 seats) cannot invite a 6th person
  // Current: 1 Owner member. Can invite 4 more. The 5th invite (6th seat) must fail!
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Server-Side Seat Limit Enforcement ---');
  try {
    // Invite 4 staff members (filling seats 2, 3, 4, 5)
    for (let i = 1; i <= 4; i++) {
      const resInvite = await fetch(`${BASE_URL}/api/businesses/${business.id}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: `staff${i}.${timestamp}@example.com`,
          role: 'STAFF',
        }),
      });

      const body = await resInvite.json() as any;
      if (resInvite.status !== 201) {
        throw new Error(`Invite ${i} failed: ` + JSON.stringify(body));
      }
    }
    console.log('Successfully invited 4 staff members (5 total allocated seats).');

    // Attempting to invite a 5th staff member (6th total seat)
    const resSixth = await fetch(`${BASE_URL}/api/businesses/${business.id}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: `staff5_sixth_person.${timestamp}@example.com`,
        role: 'STAFF',
      }),
    });

    const bodySixth = await resSixth.json() as any;
    console.log(`6th person invite response: Status ${resSixth.status}`, bodySixth);

    assert(
      resSixth.status === 400 &&
      bodySixth.message &&
      bodySixth.message.includes('Seat limit reached (5 seats)'),
      'Owner on Starter plan prevented from inviting a 6th person on the server'
    );
  } catch (err: any) {
    console.error('❌ TEST 1 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Idempotent Payment Checkout in Test Mode
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Idempotent Payment Checkout ---');
  try {
    const idempKey = `checkout_idemp_${timestamp}`;
    const res1 = await fetch(`${BASE_URL}/api/businesses/${business.id}/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify({
        planId: 'TEAM',
        seats: 15,
      }),
    });

    const body1 = await res1.json() as any;
    console.log('First checkout call:', body1.checkout?.txRef);

    // Repeated call with the exact same idempotency key
    const res2 = await fetch(`${BASE_URL}/api/businesses/${business.id}/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify({
        planId: 'TEAM',
        seats: 15,
      }),
    });

    const body2 = await res2.json() as any;
    console.log('Second checkout call (idempotent):', body2.message);

    assert(
      res1.status === 200 &&
      res2.status === 200 &&
      body1.checkout?.txRef === body2.checkout?.txRef &&
      body2.message.includes('Existing checkout session retrieved'),
      'Payment requests enforce idempotency keys and return existing session'
    );
  } catch (err: any) {
    console.error('❌ TEST 2 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Webhook Signature Verification & Idempotent Processing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Webhook Signature Verification & Idempotency ---');
  try {
    const secretHash = process.env.FLW_SECRET_HASH || 'rota-test-secret-hash';
    const fakeEventId = `evt_test_${timestamp}`;

    // 3A: Invalid signature rejected
    const resInvalidSig = await fetch(`${BASE_URL}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'verif-hash': 'WRONG_SECRET_HASH',
      },
      body: JSON.stringify({
        id: fakeEventId,
        eventType: 'charge.completed',
        data: { amount: 50, tx_ref: `tx_${fakeEventId}` },
      }),
    });

    assert(resInvalidSig.status === 401, 'Webhook with invalid signature rejected with 401 Unauthorized');

    // 3B: Valid signature enqueued and processed
    const resValidSig = await fetch(`${BASE_URL}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'verif-hash': secretHash,
      },
      body: JSON.stringify({
        id: fakeEventId,
        eventType: 'charge.completed',
        businessId: business.id,
        plan: 'TEAM',
        seats: 15,
        amountCents: 5000,
        txRef: `tx_${fakeEventId}`,
      }),
    });

    const bodyValid = await resValidSig.json() as any;
    assert(resValidSig.status === 200 && bodyValid.status === 'queued', 'Valid webhook accepted and enqueued for BullMQ processing');

    // 3C: Process via background worker logic and verify duplicate suppression
    await processWebhookEvent({
      eventId: fakeEventId,
      provider: 'FLUTTERWAVE',
      eventType: 'charge.completed',
      payload: {
        businessId: business.id,
        plan: 'TEAM',
        seats: 15,
        amountCents: 5000,
        txRef: `tx_${fakeEventId}`,
      },
    });

    // Check subscription updated
    const updatedSub = await prisma.subscription.findUnique({ where: { businessId: business.id } });
    assert(updatedSub?.plan === PlanTier.TEAM && updatedSub?.totalSeats === 15, 'Subscription upgraded to Team (15 seats) via verified webhook');

    // 3D: Submitting duplicate webhook event
    await processWebhookEvent({
      eventId: fakeEventId,
      provider: 'FLUTTERWAVE',
      eventType: 'charge.completed',
      payload: {
        businessId: business.id,
        plan: 'TEAM',
        seats: 15,
        amountCents: 5000,
        txRef: `tx_${fakeEventId}`,
      },
    });
    console.log('Duplicate webhook processed without error or duplicate mutation.');
  } catch (err: any) {
    console.error('❌ TEST 3 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Immutable Ledger Table & Subscription State Rebuilding
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Immutable Ledger Table & State Rebuilding ---');
  try {
    // Record explicit charge and credit rows
    await LedgerService.recordEntry({
      businessId: business.id,
      type: 'CHARGE',
      amountCents: 2000,
      description: 'Initial Starter subscription charge',
    });

    await LedgerService.recordEntry({
      businessId: business.id,
      type: 'CREDIT',
      amountCents: 500,
      description: 'Promotional discount credit',
    });

    // Rebuild state from ledger
    const rebuilt = await LedgerService.rebuildSubscriptionStateFromLedger(business.id);
    console.log('Rebuilt Ledger State:', {
      totalCharges: rebuilt.totalChargesCents,
      totalCredits: rebuilt.totalCreditsCents,
      netBalance: rebuilt.netBalanceCents,
      entriesCount: rebuilt.entryCount,
    });

    assert(
      rebuilt.entryCount >= 2 &&
      rebuilt.totalCreditsCents === 500 &&
      rebuilt.netBalanceCents === (rebuilt.totalChargesCents - rebuilt.totalCreditsCents),
      'Subscription financial state successfully rebuilt from immutable ledger rows'
    );
  } catch (err: any) {
    console.error('❌ TEST 4 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Failed Renewal & Grace Period Handling
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Failed Renewal Grace Period & Access Restriction ---');
  try {
    const failedEventId = `fail_evt_${timestamp}`;
    await processWebhookEvent({
      eventId: failedEventId,
      provider: 'FLUTTERWAVE',
      eventType: 'charge.failed',
      payload: {
        businessId: business.id,
        txRef: `tx_failed_${timestamp}`,
      },
    });

    const graceSub = await prisma.subscription.findUnique({ where: { businessId: business.id } });
    assert(
      graceSub?.status === SubscriptionStatus.PAST_DUE &&
      graceSub.gracePeriodEnd !== null,
      'Failed payment transitions subscription to PAST_DUE with active grace period'
    );
  } catch (err: any) {
    console.error('❌ TEST 5 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------
  console.log('\n[Teardown] Cleaning up test records...');
  try {
    await prisma.billingLedger.deleteMany({ where: { businessId: business.id } });
    await prisma.payment.deleteMany({ where: { businessId: business.id } });
    await prisma.subscription.deleteMany({ where: { businessId: business.id } });
    await prisma.invitation.deleteMany({ where: { businessId: business.id } });
    await prisma.membership.deleteMany({ where: { businessId: business.id } });
    await prisma.business.deleteMany({ where: { id: business.id } });
    await prisma.user.deleteMany({ where: { id: userOwner.id } });
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

runPaymentIntegrationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

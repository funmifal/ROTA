import { prisma } from './database/prisma';
import jwt from 'jsonwebtoken';
import { config } from './config/env';
import { NotificationService } from './modules/notifications/notification.service';
import { NotificationType } from './modules/notifications/notification.types';

const BASE_URL = 'http://127.0.0.1:5000';

function generateToken(user: { id: string; email: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, tokenVersion: 0 },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
}

async function runNotificationTests() {
  console.log('====================================================');
  console.log(' RUNNING REQUIREMENT 6 PUSH NOTIFICATIONS TEST SUITE');
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

  // 1. Setup User
  const user = await prisma.user.create({
    data: {
      name: 'Push Test User',
      email: `push.user.${timestamp}@example.com`,
      passwordHash: 'placeholder',
    },
  });

  const token = generateToken(user);

  // -------------------------------------------------------------------------
  // TEST 1: Multiple Device Registration for a Single User
  // "Register each device's push token after login and store it on the server... One user can have several devices"
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Multiple Device Registration for One User ---');
  try {
    // Register Device 1 (iPhone)
    const resDev1 = await fetch(`${BASE_URL}/api/notifications/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: `dev_iphone_${timestamp}`,
        pushToken: `ExponentPushToken[iphone_${timestamp}]`,
        platform: 'ios',
        deviceName: 'Alice iPhone 15',
      }),
    });

    const bodyDev1 = await resDev1.json() as any;

    // Register Device 2 (Android Tablet)
    const resDev2 = await fetch(`${BASE_URL}/api/notifications/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: `dev_tablet_${timestamp}`,
        pushToken: `ExponentPushToken[tablet_${timestamp}]`,
        platform: 'android',
        deviceName: 'Alice Work Tablet',
      }),
    });

    const bodyDev2 = await resDev2.json() as any;

    const userDevices = await prisma.deviceToken.findMany({
      where: { userId: user.id },
    });

    assert(
      resDev1.status === 200 &&
      resDev2.status === 200 &&
      userDevices.length === 2 &&
      userDevices.some((d) => d.platform === 'ios') &&
      userDevices.some((d) => d.platform === 'android'),
      'Single user successfully registered multiple devices (iPhone and Android Tablet) with push tokens'
    );
  } catch (err: any) {
    console.error('❌ TEST 1 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Asynchronous Background Job Sending (Non-Blocking)
  // "Send notifications from a background job, never inside the request that triggered them"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Asynchronous Background Job Dispatch ---');
  try {
    const startTime = Date.now();
    const resDispatch = await fetch(`${BASE_URL}/api/notifications/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        type: 'SHIFT_CHANGE',
        title: 'New Shift Scheduled',
        body: 'You have been assigned to Morning Service tomorrow.',
        data: {
          url: 'rota://shifts/shift_123',
          screen: 'ShiftDetails',
          params: { shiftId: 'shift_123' },
        },
      }),
    });

    const durationMs = Date.now() - startTime;
    const bodyDispatch = await resDispatch.json() as any;

    assert(
      resDispatch.status === 202 &&
      durationMs < 500 &&
      bodyDispatch.message.includes('enqueued for asynchronous background delivery'),
      'Notification dispatched asynchronously via BullMQ without blocking HTTP request (returned 202 in <500ms)'
    );
  } catch (err: any) {
    console.error('❌ TEST 2 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Invalid Push Token Cleanup
  // "Handle invalid tokens: when the push service reports a token is no longer valid, delete it"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Invalid Push Token Purging ---');
  try {
    const invalidToken = `ExponentPushToken[iphone_${timestamp}]`;
    const deleteResult = await NotificationService.removeInvalidPushTokens([invalidToken]);

    const remainingDevices = await prisma.deviceToken.findMany({
      where: { userId: user.id },
    });

    assert(
      deleteResult.count === 1 &&
      remainingDevices.length === 1 &&
      !remainingDevices.some((d) => d.pushToken === invalidToken),
      'Invalid push token reported as no longer valid was automatically deleted from the server database'
    );
  } catch (err: any) {
    console.error('❌ TEST 3 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Group Notification Types (User Toggles)
  // "Group notification types (shift changes, swaps, billing) so users can turn each type on or off"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Notification Grouping & User Preference Toggles ---');
  try {
    // Set user preferences: disable shift changes, enable swaps & billing
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        notificationsEnabled: true,
        notifyShiftChanges: false, // Turn OFF shift changes
        notifySwaps: true,          // Turn ON swaps
        notifyBilling: true,        // Turn ON billing
      },
      update: {
        notificationsEnabled: true,
        notifyShiftChanges: false,
        notifySwaps: true,
        notifyBilling: true,
      },
    });

    // Check delivery eligibility for SHIFT_CHANGE (should be blocked)
    const checkShift = await NotificationService.shouldDeliverPushNotification(user.id, NotificationType.SHIFT_CHANGE);
    // Check delivery eligibility for SWAP (should be allowed)
    const checkSwap = await NotificationService.shouldDeliverPushNotification(user.id, NotificationType.SWAP);
    // Check delivery eligibility for BILLING (should be allowed)
    const checkBilling = await NotificationService.shouldDeliverPushNotification(user.id, NotificationType.BILLING);

    assert(
      checkShift.deliver === false &&
      Boolean(checkShift.reason?.includes('Shift change notifications disabled')) &&
      checkSwap.deliver === true &&
      checkBilling.deliver === true,
      'Notification groups respected: Shift Changes blocked when turned off; Swaps and Billing delivered when turned on'
    );
  } catch (err: any) {
    console.error('❌ TEST 4 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Quiet Hours and User Time Zone on Server
  // "Respect quiet hours and the user's time zone on the server"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Server-Side Quiet Hours & Time Zone Verification ---');
  try {
    // Configure quiet hours: 22:00 to 08:00 (10 PM to 8 AM) in Africa/Lagos (UTC+1)
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: {
        notifyShiftChanges: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'Africa/Lagos',
      },
    });

    // Case 5A: Simulate 23:30 Lagos time (UTC 22:30) -> Inside quiet hours (should be suppressed)
    // 2026-10-13 22:30:00 UTC is 23:30:00 in Africa/Lagos
    const nightTimeUTC = new Date('2026-10-13T22:30:00.000Z');
    const nightCheck = await NotificationService.shouldDeliverPushNotification(
      user.id,
      NotificationType.SHIFT_CHANGE,
      nightTimeUTC
    );

    // Case 5B: Simulate 14:00 Lagos time (UTC 13:00) -> Outside quiet hours (should be delivered)
    const dayTimeUTC = new Date('2026-10-13T13:00:00.000Z');
    const dayCheck = await NotificationService.shouldDeliverPushNotification(
      user.id,
      NotificationType.SHIFT_CHANGE,
      dayTimeUTC
    );

    assert(
      nightCheck.deliver === false &&
      Boolean(nightCheck.reason?.includes('user quiet hours')) &&
      dayCheck.deliver === true,
      'Quiet hours strictly respected on server: push suppressed during 22:00-08:00 in Africa/Lagos, delivered during active day hours'
    );
  } catch (err: any) {
    console.error('❌ TEST 5 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 6: Deep Linking Payload Structure
  // "Tapping a notification opens the exact screen it refers to (deep linking)"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Deep Linking Payload Verification ---');
  try {
    const resList = await fetch(`${BASE_URL}/api/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const bodyList = await resList.json() as any;
    const latestNotif = bodyList.notifications?.[0];

    assert(
      resList.status === 200 &&
      latestNotif &&
      latestNotif.data?.url === 'rota://shifts/shift_123' &&
      latestNotif.data?.screen === 'ShiftDetails',
      'In-app notification contains exact deep linking payload (url: rota://shifts/shift_123, screen: ShiftDetails)'
    );
  } catch (err: any) {
    console.error('❌ TEST 6 ERROR:', err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------
  console.log('\n[Teardown] Cleaning up test records...');
  try {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.deviceToken.deleteMany({ where: { userId: user.id } });
    await prisma.userSettings.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
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

runNotificationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

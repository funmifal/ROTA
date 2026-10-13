import { prisma } from '../../database/prisma';
import { NotificationType, PushNotificationPayload, RegisterDeviceInput } from './notification.types';

export class NotificationService {
  /**
   * Evaluates if a given timestamp falls within the user's configured quiet hours
   * according to their specific IANA timezone (Requirement 6 & 7).
   */
  static isWithinQuietHours(
    quietHoursStart: string, // e.g. "22:00"
    quietHoursEnd: string,   // e.g. "08:00"
    timezone: string,        // e.g. "Africa/Lagos", "America/New_York"
    dateNow: Date = new Date()
  ): boolean {
    try {
      // Format current UTC date into the user's local hour and minute
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'Africa/Lagos',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(dateNow);
      const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
      const minuteStr = parts.find((p) => p.type === 'minute')?.value || '0';
      const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

      const [startH, startM] = quietHoursStart.split(':').map((v) => parseInt(v, 10));
      const [endH, endM] = quietHoursEnd.split(':').map((v) => parseInt(v, 10));
      const startMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutes = (endH || 0) * 60 + (endM || 0);

      if (startMinutes < endMinutes) {
        // Same-day window (e.g. 13:00 to 15:00)
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Overnight window (e.g. 22:00 to 08:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch (err) {
      // Fallback safely if timezone string is malformed
      return false;
    }
  }

  /**
   * Registers a user's device push token after login.
   * Linked to the user and device. One user can have several devices.
   */
  static async registerDevice(userId: string, input: RegisterDeviceInput) {
    const { deviceId, pushToken, platform = 'unknown', deviceName } = input;

    // Upsert device token for this (userId, deviceId)
    const device = await prisma.deviceToken.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
      create: {
        userId,
        deviceId,
        pushToken,
        platform,
        deviceName,
        isActive: true,
      },
      update: {
        pushToken,
        platform,
        deviceName,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return device;
  }

  /**
   * Unregisters a device (e.g. on logout).
   */
  static async unregisterDevice(userId: string, deviceId: string) {
    return await prisma.deviceToken.deleteMany({
      where: {
        userId,
        deviceId,
      },
    });
  }

  /**
   * Deletes invalid or expired push tokens reported by the push service (Expo/FCM).
   */
  static async removeInvalidPushTokens(invalidTokens: string[]) {
    if (!invalidTokens || invalidTokens.length === 0) return { count: 0 };

    const deleted = await prisma.deviceToken.deleteMany({
      where: {
        pushToken: { in: invalidTokens },
      },
    });

    console.log(`[PushService] Purged ${deleted.count} invalid device token(s) from database.`);
    return deleted;
  }

  /**
   * Checks user notification category preferences and quiet hours.
   * Returns whether push delivery is permitted.
   */
  static async shouldDeliverPushNotification(
    userId: string,
    type: NotificationType,
    dateNow: Date = new Date()
  ): Promise<{ deliver: boolean; reason?: string }> {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return { deliver: true };
    }

    // 1. Master toggle
    if (!settings.notificationsEnabled) {
      return { deliver: false, reason: 'Notifications disabled by user.' };
    }

    // 2. Category toggles
    if (type === NotificationType.SHIFT_CHANGE && !settings.notifyShiftChanges) {
      return { deliver: false, reason: 'Shift change notifications disabled by user.' };
    }

    if (type === NotificationType.SWAP && !settings.notifySwaps) {
      return { deliver: false, reason: 'Swap notifications disabled by user.' };
    }

    if (type === NotificationType.BILLING && !settings.notifyBilling) {
      return { deliver: false, reason: 'Billing notifications disabled by user.' };
    }

    // 3. Quiet hours check
    if (settings.quietHoursEnabled) {
      const inQuietHours = this.isWithinQuietHours(
        settings.quietHoursStart,
        settings.quietHoursEnd,
        settings.timezone,
        dateNow
      );

      if (inQuietHours) {
        return {
          deliver: false,
          reason: `Current time falls within user quiet hours (${settings.quietHoursStart}-${settings.quietHoursEnd} ${settings.timezone}).`,
        };
      }
    }

    return { deliver: true };
  }
}

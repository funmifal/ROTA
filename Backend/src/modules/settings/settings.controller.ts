import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';

export class SettingsController {
  static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      let settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        settings = await prisma.userSettings.create({
          data: {
            userId,
            notificationsEnabled: true,
            emailAlerts: true,
            shiftReminders: true,
            timeFormat24h: false,
            autoAcceptSwaps: false,
            theme: 'system',
          },
        });
      }

      res.status(200).json({ settings });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch user settings: ' + err.message,
      });
    }
  }

  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        notificationsEnabled,
        notifyShiftChanges,
        notifySwaps,
        notifyBilling,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
        emailAlerts,
        shiftReminders,
        timeFormat24h,
        autoAcceptSwaps,
        theme,
        language,
        clientUpdatedAt,
      } = req.body;

      // Conflict handling (Last-Write-Wins with authoritative server updatedAt):
      // Check if existing record has a newer server updatedAt than the client's snapshot
      const existingSettings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      let hadConflict = false;
      if (existingSettings && clientUpdatedAt) {
        const clientTimestamp = new Date(clientUpdatedAt).getTime();
        const serverTimestamp = existingSettings.updatedAt.getTime();
        if (serverTimestamp > clientTimestamp) {
          hadConflict = true;
          console.log(
            `[SettingsCoordination] Conflict detected for user ${userId}: Server timestamp (${existingSettings.updatedAt.toISOString()}) is newer than client snapshot (${clientUpdatedAt}). Applying Last-Write-Wins (LWW) rule.`
          );
        }
      }

      const settings = await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          notificationsEnabled: typeof notificationsEnabled === 'boolean' ? notificationsEnabled : true,
          notifyShiftChanges: typeof notifyShiftChanges === 'boolean' ? notifyShiftChanges : true,
          notifySwaps: typeof notifySwaps === 'boolean' ? notifySwaps : true,
          notifyBilling: typeof notifyBilling === 'boolean' ? notifyBilling : true,
          quietHoursEnabled: typeof quietHoursEnabled === 'boolean' ? quietHoursEnabled : false,
          quietHoursStart: typeof quietHoursStart === 'string' ? quietHoursStart : '22:00',
          quietHoursEnd: typeof quietHoursEnd === 'string' ? quietHoursEnd : '08:00',
          timezone: typeof timezone === 'string' ? timezone : 'Africa/Lagos',
          emailAlerts: typeof emailAlerts === 'boolean' ? emailAlerts : true,
          shiftReminders: typeof shiftReminders === 'boolean' ? shiftReminders : true,
          timeFormat24h: typeof timeFormat24h === 'boolean' ? timeFormat24h : false,
          autoAcceptSwaps: typeof autoAcceptSwaps === 'boolean' ? autoAcceptSwaps : false,
          theme: typeof theme === 'string' ? theme : 'system',
          language: typeof language === 'string' ? language : 'en',
          updatedAt: new Date(),
        },
        update: {
          ...(typeof notificationsEnabled === 'boolean' ? { notificationsEnabled } : {}),
          ...(typeof notifyShiftChanges === 'boolean' ? { notifyShiftChanges } : {}),
          ...(typeof notifySwaps === 'boolean' ? { notifySwaps } : {}),
          ...(typeof notifyBilling === 'boolean' ? { notifyBilling } : {}),
          ...(typeof quietHoursEnabled === 'boolean' ? { quietHoursEnabled } : {}),
          ...(typeof quietHoursStart === 'string' ? { quietHoursStart } : {}),
          ...(typeof quietHoursEnd === 'string' ? { quietHoursEnd } : {}),
          ...(typeof timezone === 'string' ? { timezone } : {}),
          ...(typeof emailAlerts === 'boolean' ? { emailAlerts } : {}),
          ...(typeof shiftReminders === 'boolean' ? { shiftReminders } : {}),
          ...(typeof timeFormat24h === 'boolean' ? { timeFormat24h } : {}),
          ...(typeof autoAcceptSwaps === 'boolean' ? { autoAcceptSwaps } : {}),
          ...(typeof theme === 'string' ? { theme } : {}),
          ...(typeof language === 'string' ? { language } : {}),
          updatedAt: new Date(),
        },
      });

      res.status(200).json({
        message: 'Settings updated successfully',
        settings,
        conflictResolved: hadConflict,
        resolutionStrategy: 'LAST_WRITE_WINS',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to update user settings: ' + err.message,
      });
    }
  }
}

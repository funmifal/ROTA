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
        emailAlerts,
        shiftReminders,
        timeFormat24h,
        autoAcceptSwaps,
        theme,
      } = req.body;

      const settings = await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          notificationsEnabled: typeof notificationsEnabled === 'boolean' ? notificationsEnabled : true,
          emailAlerts: typeof emailAlerts === 'boolean' ? emailAlerts : true,
          shiftReminders: typeof shiftReminders === 'boolean' ? shiftReminders : true,
          timeFormat24h: typeof timeFormat24h === 'boolean' ? timeFormat24h : false,
          autoAcceptSwaps: typeof autoAcceptSwaps === 'boolean' ? autoAcceptSwaps : false,
          theme: typeof theme === 'string' ? theme : 'system',
        },
        update: {
          ...(typeof notificationsEnabled === 'boolean' ? { notificationsEnabled } : {}),
          ...(typeof emailAlerts === 'boolean' ? { emailAlerts } : {}),
          ...(typeof shiftReminders === 'boolean' ? { shiftReminders } : {}),
          ...(typeof timeFormat24h === 'boolean' ? { timeFormat24h } : {}),
          ...(typeof autoAcceptSwaps === 'boolean' ? { autoAcceptSwaps } : {}),
          ...(typeof theme === 'string' ? { theme } : {}),
        },
      });

      res.status(200).json({
        message: 'Settings updated successfully',
        settings,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to update user settings: ' + err.message,
      });
    }
  }
}

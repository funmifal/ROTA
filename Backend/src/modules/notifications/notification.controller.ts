import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { NotificationService } from './notification.service';
import { enqueuePushNotification } from '../../queues/notification.queue';
import { NotificationType } from './notification.types';

export class NotificationController {
  /**
   * Registers a device push token for the authenticated user.
   * Linked to the user and device. One user can have several devices.
   */
  static async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { deviceId, pushToken, platform, deviceName } = req.body;

      const device = await NotificationService.registerDevice(userId, {
        deviceId,
        pushToken,
        platform,
        deviceName,
      });

      res.status(200).json({
        message: 'Device push token registered successfully.',
        device,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'DeviceRegistrationError',
        message: 'Failed to register device push token: ' + err.message,
      });
    }
  }

  /**
   * Unregisters a device token (e.g. on user logout).
   */
  static async unregisterDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { deviceId } = req.params;

      await NotificationService.unregisterDevice(userId, deviceId);

      res.status(200).json({
        message: 'Device push token unregistered successfully.',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to unregister device: ' + err.message,
      });
    }
  }

  /**
   * Retrieves in-app notifications for the user with deep link payloads.
   */
  static async listNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const limit = Math.min(50, parseInt(req.query.limit as string || '20', 10));

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      res.status(200).json({
        notifications,
        unreadCount,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to list notifications: ' + err.message,
      });
    }
  }

  /**
   * Marks a specific notification as read.
   */
  static async markRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId,
        },
        data: { isRead: true },
      });

      res.status(200).json({ message: 'Notification marked as read.' });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to update notification: ' + err.message,
      });
    }
  }

  /**
   * Marks all notifications as read.
   */
  static async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to mark all as read: ' + err.message,
      });
    }
  }

  /**
   * Dispatches a notification asynchronously via BullMQ (never blocks the HTTP response).
   */
  static async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, type = 'SYSTEM', title, body, data } = req.body;
      const targetUserId = userId || req.user!.id;

      await enqueuePushNotification({
        userId: targetUserId,
        type: type as NotificationType,
        title,
        body,
        data,
      });

      res.status(202).json({
        message: 'Notification enqueued for asynchronous background delivery.',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'NotificationDispatchError',
        message: 'Failed to enqueue notification: ' + err.message,
      });
    }
  }
}

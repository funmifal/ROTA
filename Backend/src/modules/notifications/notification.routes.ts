import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { NotificationController } from './notification.controller';
import { registerDeviceSchema } from './notification.validation';

const router = Router();

// Register device push token after login (linked to user and device, one user can have several devices)
router.post(
  '/devices',
  requireAuth,
  validateBody(registerDeviceSchema),
  NotificationController.registerDevice
);

// Unregister device
router.delete(
  '/devices/:deviceId',
  requireAuth,
  NotificationController.unregisterDevice
);

// List in-app notifications
router.get(
  '/',
  requireAuth,
  NotificationController.listNotifications
);

// Mark notification as read
router.patch(
  '/:notificationId/read',
  requireAuth,
  NotificationController.markRead
);

// Mark all as read
router.patch(
  '/read-all',
  requireAuth,
  NotificationController.markAllRead
);

// Enqueue notification asynchronously via BullMQ (never blocks the HTTP request)
router.post(
  '/dispatch',
  requireAuth,
  NotificationController.sendNotification
);

export default router;

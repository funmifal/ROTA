import { NotificationType } from '@prisma/client';

export interface PushNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    url?: string;
    screen?: string;
    params?: Record<string, any>;
    [key: string]: any;
  };
}

export interface RegisterDeviceInput {
  deviceId: string;
  pushToken: string;
  platform?: 'ios' | 'android' | 'web' | string;
  deviceName?: string;
}

export { NotificationType };

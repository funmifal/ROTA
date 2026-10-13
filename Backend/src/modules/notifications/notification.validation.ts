import { z } from 'zod';

export const registerDeviceSchema = z.object({
  deviceId: z.string().trim().min(1, 'deviceId is required.'),
  pushToken: z.string().trim().min(1, 'pushToken is required.'),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  deviceName: z.string().trim().max(100).optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

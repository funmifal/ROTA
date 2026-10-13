import { z } from 'zod';

export const updateSettingsSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  emailAlerts: z.boolean().optional(),
  shiftReminders: z.boolean().optional(),
  timeFormat24h: z.boolean().optional(),
  autoAcceptSwaps: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one setting must be provided.',
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

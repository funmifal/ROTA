import { z } from 'zod';

export const updateSettingsSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  notifyShiftChanges: z.boolean().optional(),
  notifySwaps: z.boolean().optional(),
  notifyBilling: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)').optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)').optional(),
  timezone: z.string().trim().optional(),
  emailAlerts: z.boolean().optional(),
  shiftReminders: z.boolean().optional(),
  timeFormat24h: z.boolean().optional(),
  autoAcceptSwaps: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one setting must be provided.',
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

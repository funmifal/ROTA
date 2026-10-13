import { z } from 'zod';

export const createShiftSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(100),
  startTime: z.string().datetime({ message: 'Valid UTC startTime ISO string is required.' }),
  endTime: z.string().datetime({ message: 'Valid UTC endTime ISO string is required.' }),
  breakMinutes: z.number().int().min(0).max(480).default(0),
  notes: z.string().trim().max(500).optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  assignedMembershipIds: z.array(z.string()).optional(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;

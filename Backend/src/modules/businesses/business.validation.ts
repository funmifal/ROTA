import { z } from 'zod';

// IANA timezone validation helper
export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, 'Business name must be at least 2 characters.').max(100, 'Business name must not exceed 100 characters.'),
  industry: z.string().trim().optional(),
  country: z.string().trim().optional(),
  timezone: z.string().trim().default('Africa/Lagos').refine((tz) => isValidIanaTimezone(tz), {
    message: 'Invalid IANA timezone identifier. Examples: "Africa/Lagos", "Europe/London", "America/New_York".',
  }),
});

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(2, 'Business name must be at least 2 characters.').max(100, 'Business name must not exceed 100 characters.').optional(),
  industry: z.string().trim().optional(),
  country: z.string().trim().optional(),
  timezone: z.string().trim().refine((tz) => isValidIanaTimezone(tz), {
    message: 'Invalid IANA timezone identifier.',
  }).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update.',
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export function validateCreateBusinessInput(input: any): CreateBusinessInput {
  return createBusinessSchema.parse(input);
}

export function validateUpdateBusinessInput(input: any): UpdateBusinessInput {
  return updateBusinessSchema.parse(input);
}

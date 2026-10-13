import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .refine(
      (val) => {
        const words = val.trim().split(/\s+/).filter(Boolean);
        return words.length >= 2;
      },
      { message: 'Please enter at least 2 words (e.g. first and last name)' }
    )
    .refine(
      (val) => /^[a-zA-Z\s]+$/.test(val),
      { message: 'Name Must Use Only Letters' }
    ),
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email('Enter A Valid Email Address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Minimum Of 8 Characters')
    .max(64, 'Password must not exceed 64 characters')
    .refine((val) => /[a-z]/.test(val), { message: 'Password must contain a lowercase letter' })
    .refine((val) => /[A-Z]/.test(val), { message: 'Password must contain an uppercase letter' })
    .refine((val) => /[0-9]/.test(val), { message: 'Password must contain a number' })
    .refine((val) => /[#@>^\W_]/.test(val), { message: 'Password must contain a special character(#@>^)' }),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(64, 'Password must not exceed 64 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

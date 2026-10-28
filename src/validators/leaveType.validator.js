import { z } from 'zod';

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  code: z.string().trim().min(2, 'Code must be at least 2 characters').toUpperCase(),
  annualQuota: z.coerce.number().min(0, 'Annual quota must be 0 or more').default(0),
  isPaid: z.boolean().default(true),
  isUnlimited: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().trim().optional().default(''),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

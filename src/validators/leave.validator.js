import { z } from 'zod';

export const applyLeaveSchema = z
  .object({
    leaveType: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid leave type ID'),
    startDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be formatted as YYYY-MM-DD'),
    endDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be formatted as YYYY-MM-DD'),
    halfDay: z.boolean().default(false),
    reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  })
  .refine((data) => !data.halfDay || data.startDate === data.endDate, {
    message: 'Half day is only permitted for single-day leave requests',
    path: ['halfDay'],
  });

export const leaveDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().optional().default(''),
  })
  .refine((data) => data.decision !== 'rejected' || (data.note && data.note.length >= 3), {
    message: 'Decision note is required when rejecting a leave request (min 3 characters)',
    path: ['note'],
  });

export const adjustBalanceSchema = z.object({
  allocated: z.coerce.number().min(0, 'Allocated days must be 0 or more'),
  reason: z.string().trim().min(3, 'Adjustment reason is required (min 3 characters)'),
});

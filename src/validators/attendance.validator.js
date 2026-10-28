import { z } from 'zod';
import { ATTENDANCE_STATUS } from '../config/constants.js';

export const attendanceCorrectionSchema = z.object({
  checkIn: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  checkOut: z.string().datetime({ offset: true }).or(z.string().min(1)).nullable().optional(),
  status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
  correctionReason: z.string().trim().min(3, 'Correction reason is required (min 3 characters)'),
});

export const createMissingAttendanceSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  checkIn: z.string().min(1, 'Check-in time is required'),
  checkOut: z.string().nullable().optional(),
  status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
  correctionReason: z.string().trim().min(3, 'Correction reason is required (min 3 characters)'),
});

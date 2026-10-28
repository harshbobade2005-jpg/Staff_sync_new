import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string({ required_error: 'Department name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  code: z.string({ required_error: 'Department code is required' }).trim().min(2, 'Code must be at least 2 characters').max(10, 'Code must be at most 10 characters').toUpperCase(),
  description: z.string().trim().optional(),
  head: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager/head user ID').nullable().optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  code: z.string().trim().min(2, 'Code must be at least 2 characters').max(10, 'Code must be at most 10 characters').toUpperCase().optional(),
  description: z.string().trim().optional(),
  head: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager/head user ID').nullable().optional(),
});

import { z } from 'zod';
import { ROLES, USER_STATUS } from '../config/constants.js';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

export const createEmployeeSchema = z.object({
  name: z.string({ required_error: 'Full name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Invalid email address'),
  role: z.enum([ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE], {
    required_error: 'Valid role is required',
  }),
  department: z.string().regex(mongoIdRegex, 'Valid department ID is required').optional().nullable(),
  designation: z.string({ required_error: 'Designation is required' }).trim().min(2, 'Designation must be at least 2 characters'),
  manager: z.string().regex(mongoIdRegex, 'Invalid manager ID').optional().nullable(),
  dateOfJoining: z.string().or(z.date()).optional(),
  phone: z.string().trim().optional(),
  dob: z.string().or(z.date()).optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  address: z.string().trim().optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().optional(),
      relation: z.string().trim().optional(),
      phone: z.string().trim().optional(),
    })
    .optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().trim().toLowerCase().email('Invalid email address').optional(),
  role: z.enum([ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE]).optional(),
  department: z.string().regex(mongoIdRegex, 'Valid department ID is required').optional().nullable(),
  designation: z.string().trim().min(2).optional(),
  manager: z.string().regex(mongoIdRegex, 'Invalid manager ID').optional().nullable(),
  dateOfJoining: z.string().or(z.date()).optional(),
  phone: z.string().trim().optional(),
  dob: z.string().or(z.date()).optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  address: z.string().trim().optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().optional(),
      relation: z.string().trim().optional(),
      phone: z.string().trim().optional(),
    })
    .optional(),
});

// Strict schema for self-service profile edits
export const updateMyProfileSchema = z
  .object({
    phone: z.string().trim().optional(),
    dob: z.string().or(z.date()).optional(),
    gender: z.enum(['male', 'female', 'other', '']).optional(),
    address: z.string().trim().optional(),
    emergencyContact: z
      .object({
        name: z.string().trim().optional(),
        relation: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      })
      .optional(),
  })
  .strict({ message: 'Only personal and emergency contact fields can be updated directly' });

export const updateStatusSchema = z.object({
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], {
    required_error: 'Status must be active or inactive',
  }),
});

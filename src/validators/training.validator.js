import { z } from 'zod';

export const createTrainingProgramSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
    description: z.string().trim().min(5, 'Description must be at least 5 characters'),
    type: z.enum(['technical', 'soft_skills', 'compliance', 'leadership', 'onboarding']).default('technical'),
    mode: z.enum(['online', 'in_person', 'hybrid']).default('online'),
    trainer: z.string().trim().optional(),
    location: z.string().trim().optional(),
    startDate: z.string().datetime({ message: 'Valid start date required (ISO format)' }),
    endDate: z.string().datetime({ message: 'Valid end date required (ISO format)' }),
    capacity: z.number().int().min(1, 'Capacity must be at least 1').default(20),
    department: z.string().optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  });

export const updateTrainingProgramSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(5).optional(),
    type: z.enum(['technical', 'soft_skills', 'compliance', 'leadership', 'onboarding']).optional(),
    mode: z.enum(['online', 'in_person', 'hybrid']).optional(),
    trainer: z.string().trim().optional(),
    location: z.string().trim().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    capacity: z.number().int().min(1).optional(),
    department: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be greater than or equal to start date',
      path: ['endDate'],
    }
  );

export const updateProgramStatusSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled']),
});

export const enrollEmployeesSchema = z.object({
  userIds: z
    .array(z.string().min(1, 'User ID cannot be empty'))
    .min(1, 'At least one employee must be selected for enrollment'),
});

export const employeeUpdateEnrollmentSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'dropped']).optional(),
  progress: z.number().min(0).max(100).optional(),
  feedback: z.string().trim().optional(),
});

export const managerUpdateEnrollmentSchema = z.object({
  score: z.number().min(0).max(100).nullable().optional(),
  managerNote: z.string().trim().optional(),
  status: z.enum(['enrolled', 'in_progress', 'completed', 'dropped']).optional(),
});

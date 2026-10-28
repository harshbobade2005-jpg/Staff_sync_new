import { z } from 'zod';
import { ROLES } from '../config/constants.js';

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  body: z.string().trim().min(3, 'Body must be at least 3 characters'),
  category: z.enum(['general', 'event', 'urgent', 'policy']).default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  audience: z
    .array(z.enum(['all', ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE]))
    .min(1, 'At least one audience role must be selected')
    .default(['all']),
  isPinned: z.boolean().default(false),
  publishAt: z.string().datetime().or(z.string().min(1)).optional(),
  expiresAt: z.string().datetime().or(z.string().min(1)).nullable().optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

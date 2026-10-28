import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  listEmployees,
  getDirectory,
  getTeam,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateMyProfile,
  updateStatus,
  resetPassword,
} from '../controllers/employee.controller.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateMyProfileSchema,
  updateStatusSchema,
} from '../validators/employee.validator.js';

const router = Router();

router.use(authenticate);

// Special routes before /:id parameter routes
router.get('/directory', getDirectory);
router.get('/team', authorize(ROLES.MANAGER, ROLES.HR), getTeam);
router.patch('/me', validate(updateMyProfileSchema), updateMyProfile);

// Collection routes
router.get('/', authorize(ROLES.HR, ROLES.MANAGER), listEmployees);
router.post('/', authorize(ROLES.HR), validate(createEmployeeSchema), createEmployee);

// Resource routes
router.get('/:id', getEmployee);
router.put('/:id', authorize(ROLES.HR), validate(updateEmployeeSchema), updateEmployee);
router.patch('/:id/status', authorize(ROLES.HR), validate(updateStatusSchema), updateStatus);
router.post('/:id/reset-password', authorize(ROLES.HR), resetPassword);

export default router;

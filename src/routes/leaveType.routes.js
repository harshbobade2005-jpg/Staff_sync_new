import { Router } from 'express';
import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
} from '../controllers/leaveType.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
} from '../validators/leaveType.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getLeaveTypes);
router.post('/', authorize(ROLES.HR), validate(createLeaveTypeSchema), createLeaveType);
router.put('/:id', authorize(ROLES.HR), validate(updateLeaveTypeSchema), updateLeaveType);
router.delete('/:id', authorize(ROLES.HR), deleteLeaveType);

export default router;

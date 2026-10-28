import { Router } from 'express';
import {
  previewLeave,
  getOwnBalances,
  getUserBalances,
  adjustBalance,
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  getPendingApprovals,
  getLeaveById,
  decideLeave,
  cancelLeave,
  getLeaveCalendar,
} from '../controllers/leave.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  applyLeaveSchema,
  leaveDecisionSchema,
  adjustBalanceSchema,
} from '../validators/leave.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

// Specific paths first (to avoid being matched by /:id)
router.get('/preview', previewLeave);
router.get('/balances', getOwnBalances);
router.get('/balances/:userId', getUserBalances);
router.patch('/balances/:id', authorize(ROLES.HR), validate(adjustBalanceSchema), adjustBalance);

router.post('/', validate(applyLeaveSchema), applyLeave);
router.get('/my', getMyLeaves);
router.get('/pending-approvals', authorize(ROLES.HR, ROLES.MANAGER), getPendingApprovals);
router.get('/calendar', getLeaveCalendar);
router.get('/', authorize(ROLES.HR, ROLES.MANAGER), getAllLeaves);

// Parameterized paths
router.get('/:id', getLeaveById);
router.patch('/:id/decision', authorize(ROLES.HR, ROLES.MANAGER), validate(leaveDecisionSchema), decideLeave);
router.patch('/:id/cancel', cancelLeave);

export default router;

import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyMonthlyAttendance,
  getTeamAttendance,
  getTeamAttendanceSummary,
  getAllAttendance,
  getMonthlyAttendanceSummary,
  exportAttendanceCsv,
  correctAttendance,
  createMissingAttendance,
} from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  attendanceCorrectionSchema,
  createMissingAttendanceSchema,
} from '../validators/attendance.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getTodayStatus);
router.get('/my', getMyMonthlyAttendance);

// Manager endpoints
router.get('/team', authorize(ROLES.MANAGER, ROLES.HR), getTeamAttendance);
router.get('/team/summary', authorize(ROLES.MANAGER, ROLES.HR), getTeamAttendanceSummary);

// HR endpoints
router.get('/summary', authorize(ROLES.HR), getMonthlyAttendanceSummary);
router.get('/export.csv', authorize(ROLES.HR), exportAttendanceCsv);
router.get('/', authorize(ROLES.HR), getAllAttendance);
router.post('/correct', authorize(ROLES.HR), validate(createMissingAttendanceSchema), createMissingAttendance);
router.put('/:id', authorize(ROLES.HR), validate(attendanceCorrectionSchema), correctAttendance);

export default router;

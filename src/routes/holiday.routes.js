import { Router } from 'express';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holiday.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createHolidaySchema,
  updateHolidaySchema,
} from '../validators/holiday.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getHolidays);
router.post('/', authorize(ROLES.HR), validate(createHolidaySchema), createHoliday);
router.put('/:id', authorize(ROLES.HR), validate(updateHolidaySchema), updateHoliday);
router.delete('/:id', authorize(ROLES.HR), deleteHoliday);

export default router;

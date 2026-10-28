import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/department.controller.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators/department.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', listDepartments);
router.get('/:id', getDepartment);
router.post('/', authorize(ROLES.HR), validate(createDepartmentSchema), createDepartment);
router.put('/:id', authorize(ROLES.HR), validate(updateDepartmentSchema), updateDepartment);
router.delete('/:id', authorize(ROLES.HR), deleteDepartment);

export default router;

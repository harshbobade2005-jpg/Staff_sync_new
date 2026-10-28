import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import * as trainingController from '../controllers/training.controller.js';
import {
  createTrainingProgramSchema,
  updateTrainingProgramSchema,
  updateProgramStatusSchema,
  enrollEmployeesSchema,
} from '../validators/training.validator.js';

const router = Router();

router.use(authenticate);

// Specific path routes before /:id parameter routes
router.get('/my', trainingController.getMyEnrollments);
router.get('/user/:userId', trainingController.getUserEnrollments);
router.get('/reports/summary', authorize('manager', 'hr'), trainingController.getTrainingSummary);
router.patch('/enrollments/:id', trainingController.updateEnrollment);

// Program CRUD routes
router.get('/', trainingController.getPrograms);
router.post(
  '/',
  authorize('manager'),
  validate(createTrainingProgramSchema),
  trainingController.createProgram
);

router.get('/:id', trainingController.getProgramById);
router.put(
  '/:id',
  authorize('manager'),
  validate(updateTrainingProgramSchema),
  trainingController.updateProgram
);
router.patch(
  '/:id/status',
  authorize('manager'),
  validate(updateProgramStatusSchema),
  trainingController.updateProgramStatus
);
router.delete('/:id', authorize('manager'), trainingController.deleteProgram);

// Program Enrollment sub-routes
router.post(
  '/:id/enroll',
  authorize('manager'),
  validate(enrollEmployeesSchema),
  trainingController.enrollEmployees
);
router.delete('/:id/enroll/:userId', authorize('manager'), trainingController.dropEnrollment);

export default router;

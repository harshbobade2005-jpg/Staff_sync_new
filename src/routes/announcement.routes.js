import { Router } from 'express';
import {
  getAnnouncements,
  getLatestAnnouncements,
  getAnnouncementById,
  getManageAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePin,
} from '../controllers/announcement.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '../validators/announcement.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getAnnouncements);
router.get('/latest', getLatestAnnouncements);
router.get('/manage', authorize(ROLES.HR), getManageAnnouncements);
router.get('/:id', getAnnouncementById);

router.post('/', authorize(ROLES.HR), validate(createAnnouncementSchema), createAnnouncement);
router.put('/:id', authorize(ROLES.HR), validate(updateAnnouncementSchema), updateAnnouncement);
router.delete('/:id', authorize(ROLES.HR), deleteAnnouncement);
router.patch('/:id/pin', authorize(ROLES.HR), togglePin);

export default router;

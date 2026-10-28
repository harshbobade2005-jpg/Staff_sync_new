import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator.js';
import { login, refresh, logout, me, changePassword, quickLogin, getQuickUsers } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/quick-login', quickLogin);
router.get('/quick-users', getQuickUsers);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);

export default router;

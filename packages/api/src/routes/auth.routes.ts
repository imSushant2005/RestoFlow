import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  clerkSync,
  changeFirstPassword,
  changePassword,
  getMe,
  getForgotPasswordQuestion,
  resetForgotPassword,
  updateProfile,
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router: Router = Router();

router.post('/register', register);
router.post('/clerk-sync', clerkSync);
router.post('/login', login);
router.post('/forgot-password/question', getForgotPasswordQuestion);
router.post('/forgot-password/reset', resetForgotPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/change-password/first-login', requireAuth, changeFirstPassword);
router.post('/change-password', requireAuth, changePassword);
router.patch('/profile', requireAuth, updateProfile);

router.get('/me', requireAuth, getMe);
router.get('/profile', requireAuth, getMe);

export default router;

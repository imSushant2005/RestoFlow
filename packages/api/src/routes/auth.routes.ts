import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  clerkSync,
  changeFirstPassword,
  getForgotPasswordQuestion,
  resetForgotPassword,
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

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, tenantId: req.tenantId });
});

export default router;

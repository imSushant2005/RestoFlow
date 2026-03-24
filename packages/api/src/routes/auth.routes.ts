import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router: Router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, tenantId: req.tenantId });
});

export default router;

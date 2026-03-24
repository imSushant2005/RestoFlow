import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import * as AdminController from '../controllers/admin.controller';

const router: Router = Router();

// Specialized explicit Super Admin protection bypassing JWTs in favor of Infrastructure Secrets
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid Admin Secret' });
  }
  next();
};

router.use(requireSuperAdmin);

router.get('/metrics', AdminController.getPlatformMetrics);
router.get('/tenants', AdminController.getAllTenants);
router.patch('/tenants/:id/suspend', AdminController.toggleTenantSuspension);

export default router;

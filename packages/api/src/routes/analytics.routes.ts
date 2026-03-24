import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { UserRole } from '@dineflow/prisma';
import * as AnalyticsController from '../controllers/analytics.controller';

const router: Router = Router();

router.use(requireAuth);
router.get('/', requireRoles([UserRole.OWNER, UserRole.MANAGER]), AnalyticsController.getAnalytics);

export default router;

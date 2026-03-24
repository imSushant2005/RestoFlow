import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { UserRole } from '@dineflow/prisma';
import * as BillingController from '../controllers/billing.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/', requireRoles([UserRole.OWNER, UserRole.MANAGER]), BillingController.getBillingDetails);
router.post('/checkout', requireRoles([UserRole.OWNER]), BillingController.createCheckoutSession);

export default router;

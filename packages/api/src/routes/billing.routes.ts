import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import * as BillingController from '../controllers/billing.controller';
import { BILLING_VIEW_ROLES, FULL_ACCESS_ROLES } from '../constants/rbac';

const router: Router = Router();

router.use(requireAuth);

router.get('/', requireRoles(BILLING_VIEW_ROLES), BillingController.getBillingDetails);
router.post('/checkout', requireRoles(FULL_ACCESS_ROLES), BillingController.createCheckoutSession);

export default router;

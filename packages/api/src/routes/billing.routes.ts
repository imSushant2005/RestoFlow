import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import * as BillingController from '../controllers/billing.controller';
import { BILLING_VIEW_ROLES, FULL_ACCESS_ROLES } from '../constants/rbac.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/', requireRoles(BILLING_VIEW_ROLES), BillingController.getBillingDetails);
router.post('/trials/start', requireRoles(FULL_ACCESS_ROLES), BillingController.startTrial);
router.post('/checkout', requireRoles(FULL_ACCESS_ROLES), BillingController.createCheckoutSession);
router.post('/attempts/:attemptId/confirm', requireRoles(FULL_ACCESS_ROLES), BillingController.confirmPayment);
router.post('/attempts/:attemptId/fail', requireRoles(FULL_ACCESS_ROLES), BillingController.failPayment);
router.post('/attempts/:attemptId/refund', requireRoles(FULL_ACCESS_ROLES), BillingController.refundPayment);
router.post('/subscription/cancel', requireRoles(FULL_ACCESS_ROLES), BillingController.cancelSubscription);

export default router;

import { Router, Request } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import * as PaymentController from '../controllers/payment.controller';
import { FULL_ACCESS_ROLES } from '../constants/rbac.js';

const router: Router = Router();

// Protected Tenant Financial Routes
router.use(requireAuth);
router.post('/create-order', requireRole(FULL_ACCESS_ROLES), PaymentController.createSubscriptionOrder);
router.post('/verify', requireRole(FULL_ACCESS_ROLES), PaymentController.verifyPayment);

export default router;

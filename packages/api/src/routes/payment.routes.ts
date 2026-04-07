import { Router, Request } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import * as PaymentController from '../controllers/payment.controller';
import express from 'express';
import { FULL_ACCESS_ROLES } from '../constants/rbac';

const router: Router = Router();

// Secure Webhooks don't use standard parsed JSON if utilizing raw signatures, but we mapped it with body parse text.
// The public webhook listener
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.handleWebhook);

// Protected Tenant Financial Routes
router.use(requireAuth);
router.post('/create-order', requireRole(FULL_ACCESS_ROLES), PaymentController.createSubscriptionOrder);
router.post('/verify', requireRole(FULL_ACCESS_ROLES), PaymentController.verifyPayment);

export default router;

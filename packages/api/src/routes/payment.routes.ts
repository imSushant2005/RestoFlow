import { Router, Request } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { UserRole } from '@dineflow/prisma';
import * as PaymentController from '../controllers/payment.controller';
import express from 'express';

const router: Router = Router();

// Secure Webhooks don't use standard parsed JSON if utilizing raw signatures, but we mapped it with body parse text.
// The public webhook listener
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.handleWebhook);

// Protected Tenant Financial Routes
router.use(requireAuth);
router.post('/create-order', requireRole(['OWNER']), PaymentController.createSubscriptionOrder);
router.post('/verify', requireRole(['OWNER']), PaymentController.verifyPayment);

export default router;

import { Router } from 'express';
import * as PublicController from '../controllers/public.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { ORDER_ACCESS_ROLES } from '../constants/rbac';
// Lazy-load customer controller at request-time to avoid startup failure
// if the compiled controller file is missing in some build contexts.

const router: Router = Router();

// Domain Resolution for White-Label SPA
router.get('/resolve-domain', PublicController.resolveCustomDomain);

// Public Menu (No Auth Required)
router.get('/:tenantSlug/menu', PublicController.getPublicMenu);

// C-5: idempotencyMiddleware added — prevents duplicate orders on double-tap / poor network
router.post('/:tenantSlug/orders', idempotencyMiddleware, PublicController.createOrder);

router.get('/:tenantSlug/sessions/:sessionToken/orders', PublicController.getSessionOrders);
router.get('/:tenantSlug/orders/:id', PublicController.getOrderInfo);
router.patch('/:tenantSlug/orders/:id/status', PublicController.updateOrderStatusPublic);
router.post('/orders/:id/feedback', PublicController.submitFeedback);
router.post('/:tenantSlug/waiter-call', PublicController.waiterCall);
router.post(
  '/:tenantSlug/waiter-call/acknowledge',
  requireAuth,
  requireRoles(ORDER_ACCESS_ROLES),
  PublicController.acknowledgeWaiterCall,
);
router.post('/customer/login', async (req, res, next) => {
	try {
		const CustomerController = await import('../controllers/customer.controller.js');
		return CustomerController.login(req, res);
	} catch (err) {
		console.error('Customer controller load error:', err);
		return res.status(500).json({ error: 'Customer login unavailable' });
	}
}); // Backward-compatible alias

export default router;

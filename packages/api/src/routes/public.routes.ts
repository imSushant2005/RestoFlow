import { Router } from 'express';
import * as PublicController from '../controllers/public.controller';
import * as TableController from '../controllers/table.controller';
// Lazy-load customer controller at request-time to avoid startup failure
// if the compiled controller file is missing in some build contexts.

const router: Router = Router();

// Domain Resolution for White-Label SPA
router.get('/resolve-domain', PublicController.resolveCustomDomain);

// Public Menu (No Auth Required)
router.get('/:tenantSlug/menu', PublicController.getPublicMenu);
router.post('/:tenantSlug/orders', PublicController.createOrder);
router.get('/:tenantSlug/sessions/:sessionToken/orders', PublicController.getSessionOrders);
router.get('/:tenantSlug/orders/:id', PublicController.getOrderInfo);
router.post('/orders/:id/feedback', PublicController.submitFeedback);
router.post('/:tenantSlug/waiter-call', PublicController.waiterCall);
router.post('/tables/:id/session', TableController.createSession);
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

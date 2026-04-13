import { Router } from 'express';
import * as SessionController from '../controllers/session.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { BILLING_VIEW_ROLES } from '../constants/rbac.js';

const router: Router = Router();

// Session lifecycle (public, customer-facing)
router.post('/:tenantSlug/sessions', SessionController.createSession);
router.get('/:tenantSlug/sessions/:sessionId', SessionController.getSession);
router.post('/:tenantSlug/sessions/:sessionId/orders', SessionController.addOrderToSession);
router.post('/:tenantSlug/sessions/:sessionId/finish', SessionController.finishSession);
router.post(
  '/:tenantSlug/sessions/:sessionId/complete',
  requireAuth,
  requireRoles(BILLING_VIEW_ROLES),
  SessionController.completeSession,
);
router.get('/:tenantSlug/sessions/:sessionId/bill', SessionController.getBill);

// Table session check
router.get('/:tenantSlug/tables/:tableId/active-session', SessionController.getActiveSession);

export default router;

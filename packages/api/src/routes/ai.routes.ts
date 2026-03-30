import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import * as AIController from '../controllers/ai.controller';

const router: Router = Router();

// Publicly accessible for anonymous storefront scanning algorithms
router.post('/upsell', AIController.getUpsellRecommendations);

// Strictly protected for authorized dashboard Administrators crafting the menus
router.post('/generate-description', requireAuth, requireRole(['OWNER', 'MANAGER']), AIController.generateDescription);
router.post('/process-image', requireAuth, requireRole(['OWNER', 'MANAGER']), AIController.processMenuImage);

export default router;

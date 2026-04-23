import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { UserRole } from '@bhojflow/prisma';
import * as TableController from '../controllers/table.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/zones', TableController.getZones);
router.post('/zones', requireRoles([UserRole.OWNER, UserRole.MANAGER]), TableController.createZone);

router.post('/tables', requireRoles([UserRole.OWNER, UserRole.MANAGER]), TableController.createTable);
router.patch('/tables/:id/position', requireRoles([UserRole.OWNER, UserRole.MANAGER]), TableController.updateTablePosition);
router.patch('/tables/:id/status', requireRoles([UserRole.OWNER, UserRole.MANAGER]), TableController.updateTableStatus);
router.delete('/tables/:id', requireRoles([UserRole.OWNER, UserRole.MANAGER]), TableController.deleteTable);

export default router;

import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

export const getPlatformMetrics = async (req: Request, res: Response) => {
  try {
    const totalTenants = await prisma.tenant.count();
    const activeTenants = await prisma.tenant.count({ where: { isActive: true } });
    
    // Naively summing total historical order value platform-wide
    const orderAggregations = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: true
    });

    res.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        grossVolume: orderAggregations._sum.totalAmount || 0,
        totalOrdersProcessed: orderAggregations._count || 0
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to aggregate Super Admin platform metrics');
    res.status(500).json({ success: false, error: 'Metrics compilation error' });
  }
};

export const getAllTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: { select: { orders: true, users: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, data: tenants });
  } catch (error) {
    logger.error({ error }, 'Failed to dump Tenant records for Super Admin');
    res.status(500).json({ success: false, error: 'Tenant lookup failed' });
  }
};

export const toggleTenantSuspension = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isActive }
    });

    logger.info({ tenantId: id, isActive }, 'Super Admin executed hard tenant suspension toggle');
    
    res.json({ success: true, message: `Tenant ${tenant.businessName} state updated`, isActive });
  } catch (error) {
    logger.error({ error }, 'Failed to alter Tenant suspension state');
    res.status(500).json({ success: false, error: 'Suspension mutation failed' });
  }
};

import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getAvailablePlans, getPlanLimits, normalizePlan, parsePlan } from '../config/plans';
import { withCache } from '../services/cache.service';

export const getBillingDetails = async (req: Request, res: Response) => {
  try {
    const billing = await withCache(
      `tenant:${req.tenantId}:billing`,
      async () => {
        const [tenant, itemsCount, tablesCount, staffCount] = await Promise.all([
          prisma.tenant.findUnique({ where: { id: req.tenantId } }),
          prisma.menuItem.count({ where: { tenantId: req.tenantId } }),
          prisma.table.count({ where: { tenantId: req.tenantId } }),
          prisma.user.count({ where: { tenantId: req.tenantId } }),
        ]);

        if (!tenant) {
          throw new Error('TENANT_NOT_FOUND');
        }

        const normalizedPlan = normalizePlan(tenant.plan);

        return {
          plan: normalizedPlan,
          limits: getPlanLimits(normalizedPlan),
          usage: {
            items: itemsCount,
            tables: tablesCount,
            staff: staffCount,
          },
          availablePlans: getAvailablePlans(),
        };
      },
      20,
    );

    res.json(billing);
  } catch (error) {
    if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const requestedPlan = parsePlan(req.body?.planId);
    if (!requestedPlan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    return res.status(503).json({
      error: 'Billing checkout is disabled until verified payment settlement is configured.',
      code: 'BILLING_NOT_CONFIGURED',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout' });
  }
};

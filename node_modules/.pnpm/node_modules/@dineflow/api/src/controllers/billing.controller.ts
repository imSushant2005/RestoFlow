import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { PLAN_LIMITS } from '../config/plans';

export const getBillingDetails = async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    
    const itemsCount = await prisma.menuItem.count({ where: { tenantId: req.tenantId } });
    const tablesCount = await prisma.table.count({ where: { tenantId: req.tenantId } });
    const staffCount = await prisma.user.count({ where: { tenantId: req.tenantId } });

    res.json({
      plan: tenant?.plan,
      limits: PLAN_LIMITS[tenant!.plan],
      usage: {
        items: itemsCount,
        tables: tablesCount,
        staff: staffCount
      },
      availablePlans: PLAN_LIMITS
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;
    if (!PLAN_LIMITS[planId as keyof typeof PLAN_LIMITS]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const stubUrl = `https://checkout.stripe.demo/pay/cs_test_stub?tenant=${req.tenantId}&plan=${planId}`;
    
    // Auto-update plan for demo since we don't have simulated webhook listeners
    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { plan: planId as any }
    });

    res.json({ url: stubUrl, simulatedSuccess: true, message: `Upgraded to ${planId} successfully!` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout' });
  }
};

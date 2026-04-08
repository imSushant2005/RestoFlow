import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getAvailablePlans, getPlanLimits, normalizePlan, parsePlan } from '../config/plans';

export const getBillingDetails = async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    
    const itemsCount = await prisma.menuItem.count({ where: { tenantId: req.tenantId } });
    const tablesCount = await prisma.table.count({ where: { tenantId: req.tenantId } });
    const staffCount = await prisma.user.count({ where: { tenantId: req.tenantId } });
    const normalizedPlan = normalizePlan(tenant.plan);

    res.json({
      plan: normalizedPlan,
      limits: getPlanLimits(normalizedPlan),
      usage: {
        items: itemsCount,
        tables: tablesCount,
        staff: staffCount
      },
      availablePlans: getAvailablePlans()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const requestedPlan = parsePlan(req.body?.planId);
    if (!requestedPlan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const stubUrl = `https://checkout.stripe.demo/pay/cs_test_stub?tenant=${req.tenantId}&plan=${requestedPlan}`;
    
    // Auto-update plan for demo since we don't have simulated webhook listeners
    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { plan: requestedPlan as any }
    });

    res.json({ url: stubUrl, simulatedSuccess: true, message: `Upgraded to ${requestedPlan} successfully!` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout' });
  }
};

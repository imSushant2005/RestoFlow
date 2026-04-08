"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = exports.getBillingDetails = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const getBillingDetails = async (req, res) => {
    try {
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const itemsCount = await prisma_1.prisma.menuItem.count({ where: { tenantId: req.tenantId } });
        const tablesCount = await prisma_1.prisma.table.count({ where: { tenantId: req.tenantId } });
        const staffCount = await prisma_1.prisma.user.count({ where: { tenantId: req.tenantId } });
        const normalizedPlan = (0, plans_1.normalizePlan)(tenant.plan);
        res.json({
            plan: normalizedPlan,
            limits: (0, plans_1.getPlanLimits)(normalizedPlan),
            usage: {
                items: itemsCount,
                tables: tablesCount,
                staff: staffCount
            },
            availablePlans: (0, plans_1.getAvailablePlans)()
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch billing' });
    }
};
exports.getBillingDetails = getBillingDetails;
const createCheckoutSession = async (req, res) => {
    try {
        const requestedPlan = (0, plans_1.parsePlan)(req.body?.planId);
        if (!requestedPlan) {
            return res.status(400).json({ error: 'Invalid plan' });
        }
        const stubUrl = `https://checkout.stripe.demo/pay/cs_test_stub?tenant=${req.tenantId}&plan=${requestedPlan}`;
        // Auto-update plan for demo since we don't have simulated webhook listeners
        await prisma_1.prisma.tenant.update({
            where: { id: req.tenantId },
            data: { plan: requestedPlan }
        });
        res.json({ url: stubUrl, simulatedSuccess: true, message: `Upgraded to ${requestedPlan} successfully!` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create checkout' });
    }
};
exports.createCheckoutSession = createCheckoutSession;
//# sourceMappingURL=billing.controller.js.map
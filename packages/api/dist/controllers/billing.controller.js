"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = exports.getBillingDetails = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const getBillingDetails = async (req, res) => {
    try {
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        const itemsCount = await prisma_1.prisma.menuItem.count({ where: { tenantId: req.tenantId } });
        const tablesCount = await prisma_1.prisma.table.count({ where: { tenantId: req.tenantId } });
        const staffCount = await prisma_1.prisma.user.count({ where: { tenantId: req.tenantId } });
        res.json({
            plan: tenant?.plan,
            limits: plans_1.PLAN_LIMITS[tenant.plan],
            usage: {
                items: itemsCount,
                tables: tablesCount,
                staff: staffCount
            },
            availablePlans: plans_1.PLAN_LIMITS
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch billing' });
    }
};
exports.getBillingDetails = getBillingDetails;
const createCheckoutSession = async (req, res) => {
    try {
        const { planId } = req.body;
        if (!plans_1.PLAN_LIMITS[planId]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }
        const stubUrl = `https://checkout.stripe.demo/pay/cs_test_stub?tenant=${req.tenantId}&plan=${planId}`;
        // Auto-update plan for demo since we don't have simulated webhook listeners
        await prisma_1.prisma.tenant.update({
            where: { id: req.tenantId },
            data: { plan: planId }
        });
        res.json({ url: stubUrl, simulatedSuccess: true, message: `Upgraded to ${planId} successfully!` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create checkout' });
    }
};
exports.createCheckoutSession = createCheckoutSession;
//# sourceMappingURL=billing.controller.js.map
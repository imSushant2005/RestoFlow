"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = exports.getBillingDetails = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const cache_service_1 = require("../services/cache.service");
const getBillingDetails = async (req, res) => {
    try {
        const billing = await (0, cache_service_1.withCache)(`tenant:${req.tenantId}:billing`, async () => {
            const [tenant, itemsCount, tablesCount, staffCount] = await Promise.all([
                prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } }),
                prisma_1.prisma.menuItem.count({ where: { tenantId: req.tenantId } }),
                prisma_1.prisma.table.count({ where: { tenantId: req.tenantId } }),
                prisma_1.prisma.user.count({ where: { tenantId: req.tenantId } }),
            ]);
            if (!tenant) {
                throw new Error('TENANT_NOT_FOUND');
            }
            const normalizedPlan = (0, plans_1.normalizePlan)(tenant.plan);
            return {
                plan: normalizedPlan,
                limits: (0, plans_1.getPlanLimits)(normalizedPlan),
                usage: {
                    items: itemsCount,
                    tables: tablesCount,
                    staff: staffCount,
                },
                availablePlans: (0, plans_1.getAvailablePlans)(),
            };
        }, 20);
        res.json(billing);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'TENANT_NOT_FOUND') {
            return res.status(404).json({ error: 'Tenant not found' });
        }
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
        await (0, cache_service_1.deleteCache)(`tenant:${req.tenantId}:billing`);
        res.json({ url: stubUrl, simulatedSuccess: true, message: `Upgraded to ${requestedPlan} successfully!` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create checkout' });
    }
};
exports.createCheckoutSession = createCheckoutSession;
//# sourceMappingURL=billing.controller.js.map
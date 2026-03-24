"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleTenantSuspension = exports.getAllTenants = exports.getPlatformMetrics = void 0;
const prisma_1 = require("../db/prisma");
const logger_1 = require("../utils/logger");
const getPlatformMetrics = async (req, res) => {
    try {
        const totalTenants = await prisma_1.prisma.tenant.count();
        const activeTenants = await prisma_1.prisma.tenant.count({ where: { isActive: true } });
        // Naively summing total historical order value platform-wide
        const orderAggregations = await prisma_1.prisma.order.aggregate({
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
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to aggregate Super Admin platform metrics');
        res.status(500).json({ success: false, error: 'Metrics compilation error' });
    }
};
exports.getPlatformMetrics = getPlatformMetrics;
const getAllTenants = async (req, res) => {
    try {
        const tenants = await prisma_1.prisma.tenant.findMany({
            include: {
                _count: { select: { orders: true, users: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: tenants });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to dump Tenant records for Super Admin');
        res.status(500).json({ success: false, error: 'Tenant lookup failed' });
    }
};
exports.getAllTenants = getAllTenants;
const toggleTenantSuspension = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const tenant = await prisma_1.prisma.tenant.update({
            where: { id },
            data: { isActive }
        });
        logger_1.logger.info({ tenantId: id, isActive }, 'Super Admin executed hard tenant suspension toggle');
        res.json({ success: true, message: `Tenant ${tenant.businessName} state updated`, isActive });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to alter Tenant suspension state');
        res.status(500).json({ success: false, error: 'Suspension mutation failed' });
    }
};
exports.toggleTenantSuspension = toggleTenantSuspension;
//# sourceMappingURL=admin.controller.js.map
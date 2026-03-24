"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const prisma_1 = require("../db/prisma");
const getAnalytics = async (req, res) => {
    try {
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                tenantId: req.tenantId,
                status: 'COMPLETED',
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // last 30 days
            },
            include: {
                items: { include: { menuItem: true } }
            }
        });
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const totalSessions = await prisma_1.prisma.customerSession.count({
            where: {
                tenantId: req.tenantId,
                startedAt: { gte: thirtyDaysAgo }
            }
        });
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        // Top items
        const itemCounts = {};
        orders.forEach((o) => {
            o.items.forEach((i) => {
                if (!itemCounts[i.menuItemId]) {
                    itemCounts[i.menuItemId] = { name: i.menuItem.name, count: 0, revenue: 0 };
                }
                itemCounts[i.menuItemId].count += i.quantity;
                itemCounts[i.menuItemId].revenue += i.quantity * i.price;
            });
        });
        const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5);
        // Peak hours
        const hourCounts = {};
        for (let i = 0; i < 24; i++)
            hourCounts[i] = 0;
        orders.forEach((o) => {
            const hour = new Date(o.createdAt).getHours();
            hourCounts[hour]++;
        });
        const peakHours = Object.entries(hourCounts).map(([hour, count]) => ({ hour: `${hour}:00`, count }));
        // Revenue over time (daily)
        const dailyRevenue = {};
        orders.forEach((o) => {
            const date = new Date(o.createdAt).toLocaleDateString();
            dailyRevenue[date] = (dailyRevenue[date] || 0) + (o.totalAmount || 0);
        });
        const revenueChart = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue }));
        // Funnel construction
        const funnelSteps = [
            { name: 'Menu Views', value: totalSessions < orders.length ? orders.length * 2 : totalSessions },
            { name: 'Orders Placed', value: orders.length }
        ];
        res.json({
            summary: {
                totalOrders: orders.length,
                totalRevenue,
                conversionRate: totalSessions > 0 ? ((orders.length / totalSessions) * 100).toFixed(1) : 0
            },
            topItems,
            peakHours,
            revenueChart,
            funnelSteps
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};
exports.getAnalytics = getAnalytics;
//# sourceMappingURL=analytics.controller.js.map
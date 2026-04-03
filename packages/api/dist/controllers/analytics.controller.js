"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const prisma_1 = require("../db/prisma");
const getAnalytics = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // Parallelize queries for maximum throughput
        const [summary, totalSessions, topItems, peakHoursRaw, dailyRevenueRaw] = await Promise.all([
            // 1. Core Summary: Aggregated counts and sums
            prisma_1.prisma.order.aggregate({
                where: {
                    tenantId,
                    status: 'RECEIVED',
                    createdAt: { gte: thirtyDaysAgo }
                },
                _count: { id: true },
                _sum: { totalAmount: true }
            }),
            // 2. Traffic Analysis
            prisma_1.prisma.customerSession.count({
                where: {
                    tenantId,
                    startedAt: { gte: thirtyDaysAgo }
                }
            }),
            // 3. Most Popular Items (Snapshot from OrderItems)
            prisma_1.prisma.orderItem.groupBy({
                by: ['menuItemId', 'name'],
                where: {
                    order: {
                        tenantId,
                        status: 'RECEIVED',
                        createdAt: { gte: thirtyDaysAgo }
                    }
                },
                _sum: {
                    quantity: true,
                    totalPrice: true
                },
                orderBy: {
                    _sum: {
                        quantity: 'desc'
                    }
                },
                take: 5
            }),
            // 4. Hotspot Analysis (Extract Hour via Raw SQL)
            prisma_1.prisma.$queryRaw `
        SELECT 
          EXTRACT(HOUR FROM "createdAt")::int as hour, 
          COUNT(*)::bigint as count 
        FROM "Order" 
        WHERE "tenantId" = ${tenantId} 
          AND "status" = 'RECEIVED' 
          AND "createdAt" >= ${thirtyDaysAgo} 
        GROUP BY hour 
        ORDER BY hour ASC
      `,
            // 5. Time-series Financial Data
            prisma_1.prisma.$queryRaw `
        SELECT 
          TO_CHAR("createdAt", 'YYYY-MM-DD') as date, 
          SUM("totalAmount")::float as revenue
        FROM "Order" 
        WHERE "tenantId" = ${tenantId} 
          AND "status" = 'RECEIVED' 
          AND "createdAt" >= ${thirtyDaysAgo} 
        GROUP BY date 
        ORDER BY date ASC
      `
        ]);
        // Data Transformation for UI consumption
        const formattedTopItems = topItems.map(item => ({
            name: item.name,
            count: item._sum?.quantity || 0,
            revenue: item._sum?.totalPrice || 0
        }));
        // Fill missing hours with zeros for even chart distribution
        const hourCounts = {};
        for (let i = 0; i < 24; i++)
            hourCounts[i] = 0;
        peakHoursRaw.forEach(row => {
            hourCounts[row.hour] = Number(row.count);
        });
        const formattedPeakHours = Object.entries(hourCounts).map(([hour, count]) => ({
            hour: `${hour}:00`,
            count
        }));
        const totalOrders = summary._count?.id || 0;
        const totalRevenue = summary._sum?.totalAmount || 0;
        // Funnel Logic
        const funnelSteps = [
            { name: 'Menu Views', value: totalSessions < totalOrders ? totalOrders * 2 : totalSessions },
            { name: 'Orders Placed', value: totalOrders }
        ];
        res.json({
            summary: {
                totalOrders,
                totalRevenue,
                conversionRate: totalSessions > 0 ? ((totalOrders / totalSessions) * 100).toFixed(1) : 0
            },
            topItems: formattedTopItems,
            peakHours: formattedPeakHours,
            revenueChart: dailyRevenueRaw,
            funnelSteps
        });
    }
    catch (error) {
        console.error('RESTOFLOW_ANALYTICS_FAILURE:', error);
        res.status(500).json({ error: 'Failed to synthesize dashboard analytics' });
    }
};
exports.getAnalytics = getAnalytics;
//# sourceMappingURL=analytics.controller.js.map
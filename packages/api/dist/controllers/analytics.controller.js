"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const prisma_1 = require("../db/prisma");
const cache_service_1 = require("../services/cache.service");
const ANALYTICS_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const MAX_ANALYTICS_DAYS = 90; // hard cap — prevents multi-year full-table scans
const getAnalytics = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const daysParam = Number(req.query.days || 30);
        const fromParam = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
        const toParam = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
        // Cap days to MAX_ANALYTICS_DAYS — ?days=9999 would full-scan years of orders
        const days = Math.min(Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30, MAX_ANALYTICS_DAYS);
        const fromDate = fromParam && !Number.isNaN(fromParam.getTime()) ? fromParam : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const toDate = toParam && !Number.isNaN(toParam.getTime()) ? toParam : new Date();
        // Truncate to the hour so closely-timed requests share a cache slot
        const cacheKey = `analytics:${tenantId}:${Math.floor(fromDate.getTime() / 3_600_000)}:${Math.floor(toDate.getTime() / 3_600_000)}`;
        const result = await (0, cache_service_1.withCache)(cacheKey, async () => {
            // Parallelize queries for maximum throughput
            const [summary, totalSessions, topItems, peakHoursRaw, dailyRevenueRaw, expensesSummary] = await Promise.all([
                // 1. Core Summary: Aggregated counts and sums
                prisma_1.prisma.order.aggregate({
                    where: {
                        tenantId,
                        status: 'RECEIVED',
                        createdAt: { gte: fromDate, lte: toDate }
                    },
                    _count: { id: true },
                    _sum: { totalAmount: true }
                }),
                // 2. Traffic Analysis
                prisma_1.prisma.diningSession.count({
                    where: {
                        tenantId,
                        openedAt: { gte: fromDate, lte: toDate }
                    }
                }),
                // 3. Most Popular Items (Snapshot from OrderItems)
                prisma_1.prisma.orderItem.groupBy({
                    by: ['menuItemId', 'name'],
                    where: {
                        order: {
                            tenantId,
                            status: 'RECEIVED',
                            createdAt: { gte: fromDate, lte: toDate }
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
              AND "createdAt" >= ${fromDate}
              AND "createdAt" <= ${toDate}
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
              AND "createdAt" >= ${fromDate}
              AND "createdAt" <= ${toDate}
            GROUP BY date 
            ORDER BY date ASC
          `,
                // 6. Expenses Summary
                prisma_1.prisma.expense.aggregate({
                    where: {
                        tenantId,
                        date: { gte: fromDate, lte: toDate }
                    },
                    _sum: { amount: true }
                })
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
            const totalExpenses = expensesSummary._sum?.amount || 0;
            // Funnel Logic
            const funnelSteps = [
                { name: 'Menu Views', value: totalSessions < totalOrders ? totalOrders * 2 : totalSessions },
                { name: 'Orders Placed', value: totalOrders }
            ];
            return {
                summary: {
                    totalOrders,
                    totalRevenue,
                    totalExpenses,
                    netProfit: totalRevenue - totalExpenses,
                    conversionRate: totalSessions > 0 ? ((totalOrders / totalSessions) * 100).toFixed(1) : 0
                },
                topItems: formattedTopItems,
                peakHours: formattedPeakHours,
                revenueChart: dailyRevenueRaw,
                funnelSteps,
                dateRange: {
                    from: fromDate.toISOString(),
                    to: toDate.toISOString(),
                    days,
                }
            };
        }, ANALYTICS_CACHE_TTL_SECONDS);
        res.json(result);
    }
    catch (error) {
        console.error('RESTOFLOW_ANALYTICS_FAILURE:', error);
        res.status(500).json({ error: 'Failed to synthesize dashboard analytics' });
    }
};
exports.getAnalytics = getAnalytics;
//# sourceMappingURL=analytics.controller.js.map
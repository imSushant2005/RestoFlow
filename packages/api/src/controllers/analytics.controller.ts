import { Request, Response } from 'express';
import { prisma } from '../db/prisma';

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const daysParam = Number(req.query.days || 30);
    const fromParam = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const toParam = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30;
    const fromDate = fromParam && !Number.isNaN(fromParam.getTime()) ? fromParam : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const toDate = toParam && !Number.isNaN(toParam.getTime()) ? toParam : new Date();

    // Parallelize queries for maximum throughput
    const [
      summary,
      totalSessions,
      topItems,
      peakHoursRaw,
      dailyRevenueRaw
    ] = await Promise.all([
      // 1. Core Summary: Aggregated counts and sums
      prisma.order.aggregate({
        where: {
          tenantId,
          status: 'RECEIVED' as any,
          createdAt: { gte: fromDate, lte: toDate }
        },
        _count: { id: true },
        _sum: { totalAmount: true }
      }),

      // 2. Traffic Analysis
      prisma.diningSession.count({
        where: {
          tenantId,
          openedAt: { gte: fromDate, lte: toDate }
        }
      }),

      // 3. Most Popular Items (Snapshot from OrderItems)
      prisma.orderItem.groupBy({
        by: ['menuItemId', 'name'],
        where: {
          order: {
            tenantId,
            status: 'RECEIVED' as any,
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
      prisma.$queryRaw<Array<{ hour: number, count: bigint }>>`
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
      prisma.$queryRaw<Array<{ date: string, revenue: number }>>`
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
      `
    ]);

    // Data Transformation for UI consumption
    const formattedTopItems = topItems.map(item => ({
      name: item.name,
      count: item._sum?.quantity || 0,
      revenue: item._sum?.totalPrice || 0
    }));

    // Fill missing hours with zeros for even chart distribution
    const hourCounts: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourCounts[i] = 0;
    peakHoursRaw.forEach(row => {
      hourCounts[row.hour] = Number(row.count);
    });
    const formattedPeakHours = Object.entries(hourCounts).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count
    }));

    const totalOrders = (summary._count as any)?.id || 0;
    const totalRevenue = (summary._sum as any)?.totalAmount || 0;

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
      funnelSteps,
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        days,
      }
    });
  } catch (error) {
    console.error('RESTOFLOW_ANALYTICS_FAILURE:', error);
    res.status(500).json({ error: 'Failed to synthesize dashboard analytics' });
  }
};

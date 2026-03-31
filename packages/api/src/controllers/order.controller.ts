import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';
import { sendWhatsAppNotification } from '../services/notification.service';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { 
        tenantId: req.tenantId,
        status: { notIn: ['RECEIVED' as any, 'CANCELLED' as any] } // Only active orders
      },
      include: {
        table: true,
        diningSession: { include: { customer: true } },
        items: {
          include: {
            menuItem: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const getOrderHistory = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const statusQuery = (req.query.status as string | undefined)?.toUpperCase();
    const skip = (page - 1) * limit;
    const statusFilter =
      statusQuery === 'RECEIVED' || statusQuery === 'CANCELLED'
        ? { in: [statusQuery] as Array<any> }
        : { in: ['RECEIVED', 'CANCELLED'] as Array<any> };
    const whereClause = {
      tenantId: req.tenantId,
      status: statusFilter,
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          table: true,
          items: { include: { menuItem: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where: whereClause
      })
    ]);

    res.json({
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body;
    const existingOrder = await prisma.order.findFirst({
      where: { id, tenantId: req.tenantId },
      select: { id: true, tableId: true, sessionId: true, customerPhone: true, customerName: true, orderNumber: true }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const dataToUpdate: any = { status };
    if (cancelReason !== undefined) dataToUpdate.cancellationReason = cancelReason;
    if (status === 'RECEIVED') dataToUpdate.completedAt = new Date();
    if (status === 'CANCELLED') dataToUpdate.cancelledAt = new Date();
    if (status === 'ACCEPTED') dataToUpdate.acceptedAt = new Date();
    if (status === 'PREPARING') dataToUpdate.preparingAt = new Date();
    if (status === 'READY') dataToUpdate.readyAt = new Date();

    const order = await prisma.order.update({
      where: { id: existingOrder.id },
      data: dataToUpdate,
      include: {
        table: true,
        items: {
          include: {
            menuItem: true
          }
        }
      }
    });

    getIO().to(getTenantRoom(req.tenantId!)).emit('order:update', order);
    if (order.sessionId) {
      getIO().to(getSessionRoom(req.tenantId!, order.sessionId)).emit('order:update', order);
    }

    // Auto Table Update on Completion
    if ((status === 'RECEIVED' || status === 'CANCELLED') && order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'CLEANING', currentOrderId: null, occupiedSeats: [] }
      });
      getIO().to(getTenantRoom(req.tenantId!)).emit('table:status_change', { tableId: order.tableId, status: 'CLEANING' });
    }

    // Omni-channel Smart Notifications
    if (order.customerPhone) {
      if (status === 'ACCEPTED') {
        await sendWhatsAppNotification(order.customerPhone, `Hi ${order.customerName || 'Customer'}! Your order ${order.orderNumber} has been accepted and is being prepared! 🧑‍🍳`);
      } else if (status === 'READY') {
        await sendWhatsAppNotification(order.customerPhone, `Great news! Your order ${order.orderNumber} is ready! 🍔 Pls collect it or our staff will serve it shortly.`);
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

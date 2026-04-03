"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrderHistory = exports.getOrders = void 0;
const prisma_1 = require("../db/prisma");
const socket_1 = require("../socket");
const notification_service_1 = require("../services/notification.service");
const getOrders = async (req, res) => {
    try {
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                tenantId: req.tenantId,
                status: { notIn: ['RECEIVED', 'CANCELLED'] } // Only active orders
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};
exports.getOrders = getOrders;
const getOrderHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const statusQuery = req.query.status?.toUpperCase();
        const skip = (page - 1) * limit;
        const statusFilter = statusQuery === 'RECEIVED' || statusQuery === 'CANCELLED'
            ? { in: [statusQuery] }
            : { in: ['RECEIVED', 'CANCELLED'] };
        const whereClause = {
            tenantId: req.tenantId,
            status: statusFilter,
        };
        const [orders, total] = await Promise.all([
            prisma_1.prisma.order.findMany({
                where: whereClause,
                include: {
                    table: true,
                    items: { include: { menuItem: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.order.count({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
};
exports.getOrderHistory = getOrderHistory;
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, cancelReason } = req.body;
        const existingOrder = await prisma_1.prisma.order.findFirst({
            where: { id, tenantId: req.tenantId },
            select: { id: true, tableId: true, diningSessionId: true, customerPhone: true, customerName: true, orderNumber: true }
        });
        if (!existingOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const dataToUpdate = { status };
        if (cancelReason !== undefined)
            dataToUpdate.cancellationReason = cancelReason;
        if (status === 'RECEIVED')
            dataToUpdate.completedAt = new Date();
        if (status === 'CANCELLED')
            dataToUpdate.cancelledAt = new Date();
        if (status === 'ACCEPTED')
            dataToUpdate.acceptedAt = new Date();
        if (status === 'PREPARING')
            dataToUpdate.preparingAt = new Date();
        if (status === 'READY')
            dataToUpdate.readyAt = new Date();
        const order = await prisma_1.prisma.order.update({
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
        (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(req.tenantId)).emit('order:update', order);
        if (order.diningSessionId) {
            (0, socket_1.getIO)().to((0, socket_1.getSessionRoom)(req.tenantId, order.diningSessionId)).emit('order:update', order);
        }
        // Auto Table Update on Completion
        if ((status === 'RECEIVED' || status === 'CANCELLED') && order.tableId) {
            await prisma_1.prisma.table.update({
                where: { id: order.tableId },
                data: { status: 'CLEANING', currentOrderId: null, occupiedSeats: [] }
            });
            (0, socket_1.getIO)().to((0, socket_1.getTenantRoom)(req.tenantId)).emit('table:status_change', { tableId: order.tableId, status: 'CLEANING' });
        }
        // Omni-channel Smart Notifications
        if (order.customerPhone) {
            if (status === 'ACCEPTED') {
                await (0, notification_service_1.sendWhatsAppNotification)(order.customerPhone, `Hi ${order.customerName || 'Customer'}! Your order ${order.orderNumber} has been accepted and is being prepared! 🧑‍🍳`);
            }
            else if (status === 'READY') {
                await (0, notification_service_1.sendWhatsAppNotification)(order.customerPhone, `Great news! Your order ${order.orderNumber} is ready! 🍔 Pls collect it or our staff will serve it shortly.`);
            }
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
//# sourceMappingURL=order.controller.js.map
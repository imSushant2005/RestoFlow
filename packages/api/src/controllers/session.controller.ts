import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO, getTenantRoom } from '../socket';

/**
 * POST /:tenantSlug/sessions
 * Create a new dining session (after login + party size)
 */
export const createSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { customerId, tableId, partySize } = req.body;

    if (!customerId) return res.status(400).json({ error: 'customerId required' });
    if (!partySize || partySize < 1) return res.status(400).json({ error: 'partySize must be >= 1' });

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });

    // Check if table already has an active session
    if (tableId) {
      const existingSession = await prisma.diningSession.findFirst({
        where: {
          tableId,
          tenantId: tenant.id,
          sessionStatus: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      });
      if (existingSession) {
        return res.status(409).json({
          error: 'Table has an active session',
          existingSessionId: existingSession.id,
        });
      }
    }

    // Check table capacity
    if (tableId) {
      const table = await prisma.table.findUnique({ where: { id: tableId } });
      if (table && partySize > table.capacity) {
        return res.status(400).json({
          error: 'Party size exceeds table capacity',
          maxCapacity: table.capacity,
        });
      }
    }

    // Create session + update table status in a transaction
    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.diningSession.create({
        data: {
          tenantId: tenant.id,
          tableId: tableId || null,
          customerId,
          partySize,
          sessionStatus: 'SEATED',
          source: 'qr',
        },
        include: {
          table: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
        },
      });

      // Mark table as occupied
      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: {
            status: 'OCCUPIED',
            currentSessionId: newSession.id,
          },
        });
      }

      return newSession;
    });

    // Notify vendor dashboard
    getIO().to(getTenantRoom(tenant.id)).emit('session:new', {
      id: session.id,
      tableId: session.tableId,
      tableName: session.table?.name,
      customerName: session.customer?.name,
      partySize: session.partySize,
      openedAt: session.openedAt,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('createSession error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

/**
 * GET /:tenantSlug/sessions/:sessionId
 * Get session with all orders + running total
 */
export const getSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.diningSession.findUnique({
      where: { id: sessionId },
      include: {
        tenant: {
          select: { businessName: true, slug: true, logoUrl: true, taxRate: true, currencySymbol: true },
        },
        table: { select: { name: true, capacity: true } },
        customer: { select: { id: true, name: true, phone: true } },
        orders: {
          where: { status: { not: 'CANCELLED' } },
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        bill: true,
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Calculate running total
    const runningTotal = session.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
    const itemCount = session.orders.reduce(
      (sum: number, order: any) => sum + order.items.reduce((s: number, i: any) => s + i.quantity, 0),
      0
    );

    res.json({
      ...session,
      runningTotal,
      itemCount,
    });
  } catch (error) {
    console.error('getSession error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/orders
 * Add a new order to the session
 */
export const addOrderToSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { sessionId } = req.params;
    const { items, specialInstructions, placedBy } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });

    // Verify session is still open
    const session = await prisma.diningSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (['COMPLETED', 'CANCELLED', 'BILL_GENERATED'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is closed. No more orders can be added.' });
    }

    // Build order items with snapshots
    const menuItemIds = items.map((i: any) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, tenantId: tenant.id },
    });
    const menuMap = new Map(menuItems.map(m => [m.id, m]));

    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      const unitPrice = menuItem.price;
      const qty = item.quantity || 1;
      const totalPrice = unitPrice * qty;
      subtotal += totalPrice;
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        imageUrl: menuItem.images?.[0] || null,
        unitPrice,
        quantity: qty,
        totalPrice,
        selectedModifiers: item.selectedModifiers || [],
        specialNote: item.specialNote || null,
        isVeg: menuItem.isVeg,
      };
    });

    const taxAmount = subtotal * (tenant.taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // Generate order number
    const orderNumber = `#${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          tableId: session.tableId,
          diningSessionId: sessionId,
          orderNumber,
          orderType: 'DINE_IN',
          status: 'PENDING',
          placedBy: placedBy || 'customer',
          subtotal,
          taxAmount,
          totalAmount,
          specialInstructions,
          items: { create: orderItems },
        },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          table: { select: { name: true } },
        },
      });

      // Update session status
      await tx.diningSession.update({
        where: { id: sessionId },
        data: { sessionStatus: 'KITCHEN_ACTIVE' },
      });

      // Update table status
      if (session.tableId) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: 'ORDERING', currentOrderId: newOrder.id },
        });
      }

      return newOrder;
    });

    // Notify vendor dashboard + KDS
    getIO().to(getTenantRoom(tenant.id)).emit('order:new', order);

    res.status(201).json(order);
  } catch (error: any) {
    console.error('addOrderToSession error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/finish
 * Customer or vendor finishes the session → generates bill
 */
export const finishSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { sessionId } = req.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });

    const session = await prisma.diningSession.findUnique({
      where: { id: sessionId },
      include: {
        orders: {
          where: { status: { notIn: ['CANCELLED'] } },
          include: { items: true },
        },
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (['COMPLETED', 'CANCELLED', 'BILL_GENERATED'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    // Calculate bill from all non-cancelled orders
    const subtotal = session.orders.reduce((sum: number, o: any) => sum + o.subtotal, 0);
    const taxAmount = session.orders.reduce((sum: number, o: any) => sum + o.taxAmount, 0);
    const totalAmount = session.orders.reduce((sum: number, o: any) => sum + o.totalAmount, 0);

    const result = await prisma.$transaction(async (tx) => {
      // Create bill
      const bill = await tx.bill.create({
        data: {
          tenantId: tenant.id,
          sessionId,
          subtotal,
          taxAmount,
          totalAmount,
        },
      });

      // Update session
      const updatedSession = await tx.diningSession.update({
        where: { id: sessionId },
        data: {
          sessionStatus: 'BILL_GENERATED',
          isBillGenerated: true,
          billGeneratedAt: new Date(),
        },
        include: {
          tenant: { select: { businessName: true, currencySymbol: true } },
          table: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
          bill: true,
        },
      });

      // Update table status
      if (session.tableId) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: 'AWAITING_BILL' },
        });
      }

      return updatedSession;
    });

    // Notify vendor
    getIO().to(getTenantRoom(tenant.id)).emit('session:finished', {
      sessionId: result.id,
      tableName: result.table?.name,
      totalAmount: result.bill?.totalAmount,
    });

    res.json(result);
  } catch (error) {
    console.error('finishSession error:', error);
    res.status(500).json({ error: 'Failed to finish session' });
  }
};

/**
 * POST /:tenantSlug/sessions/:sessionId/complete
 * Mark session as fully completed (after payment)
 */
export const completeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { paymentMethod } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.diningSession.update({
        where: { id: sessionId },
        data: {
          sessionStatus: 'COMPLETED',
          closedAt: new Date(),
        },
      });

      // Update bill payment
      if (session.isBillGenerated) {
        await tx.bill.updateMany({
          where: { sessionId },
          data: {
            paymentStatus: 'PAID',
            paymentMethod: paymentMethod || 'cash',
            paidAt: new Date(),
          },
        });
      }

      // Mark all orders as completed
      await tx.order.updateMany({
        where: { diningSessionId: sessionId, status: { notIn: ['CANCELLED'] } },
        data: { status: 'COMPLETED', completedAt: new Date(), isPaid: true, paymentMethod },
      });

      // Free up table
      if (session.tableId) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: 'AVAILABLE', currentOrderId: null, currentSessionId: null },
        });
      }

      return session;
    });

    res.json(result);
  } catch (error) {
    console.error('completeSession error:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
};

/**
 * GET /:tenantSlug/sessions/:sessionId/bill
 * Get the generated bill for a session
 */
export const getBill = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.diningSession.findUnique({
      where: { id: sessionId },
      include: {
        tenant: {
          select: { businessName: true, currencySymbol: true, taxRate: true, address: true, phone: true },
        },
        table: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        orders: {
          where: { status: { notIn: ['CANCELLED'] } },
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        bill: true,
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.bill) return res.status(404).json({ error: 'Bill not generated yet' });

    res.json(session);
  } catch (error) {
    console.error('getBill error:', error);
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
};

/**
 * GET /:tenantSlug/tables/:tableId/active-session
 * Check if a table has an active session
 */
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, tableId } = req.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });

    const session = await prisma.diningSession.findFirst({
      where: {
        tableId,
        tenantId: tenant.id,
        sessionStatus: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        table: { select: { name: true } },
      },
    });

    res.json({ activeSession: session || null });
  } catch (error) {
    console.error('getActiveSession error:', error);
    res.status(500).json({ error: 'Failed to check active session' });
  }
};

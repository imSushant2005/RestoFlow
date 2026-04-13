import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';

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

    // Optimization: Parallelize all prerequisite checks
    const [tenant, existingSession, table] = await Promise.all([
      prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, businessName: true } }),
      tableId ? prisma.diningSession.findFirst({
        where: {
          tableId,
          tenantId: undefined, // Will filter by tenant.id later if needed, but tableId is unique globally here
          sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
        },
        select: { id: true, tenantId: true }
      }) : Promise.resolve(null),
      tableId ? prisma.table.findUnique({ where: { id: tableId }, select: { capacity: true } }) : Promise.resolve(null)
    ]);

    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });

    // Validate if existing session belongs to this tenant
    if (existingSession && existingSession.tenantId === tenant.id) {
      return res.status(409).json({
        error: 'Table has an active session',
        existingSessionId: existingSession.id,
      });
    }

    if (table && partySize > table.capacity) {
      return res.status(400).json({
        error: 'Party size exceeds table capacity',
        maxCapacity: table.capacity,
      });
    }


    // Create session + update table status in a transaction
    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.diningSession.create({
        data: {
          tenantId: tenant.id,
          tableId: tableId || null,
          customerId,
          partySize,
          sessionStatus: 'OPEN' as any,
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
      tableName: (session as any).table?.name,
      customerName: (session as any).customer?.name,
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
    if (['CLOSED', 'CANCELLED', 'AWAITING_BILL'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is closed. No more orders can be added.' });
    }

    // Build order items with snapshots
    const menuItemIds = items.map((i: any) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, tenantId: tenant.id },
      include: {
        modifierGroups: {
          include: {
            modifiers: {
              where: { isAvailable: true },
            },
          },
        },
      },
    });
    const menuMap = new Map(menuItems.map(m => [m.id, m]));

    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      const incomingModifiers = Array.isArray(item.selectedModifiers)
        ? item.selectedModifiers
        : Array.isArray(item.modifiers)
          ? item.modifiers
          : [];
      const modifierMap = new Map(
        (menuItem.modifierGroups || [])
          .flatMap((group) =>
            (group.modifiers || []).map((modifier) => [
              modifier.id,
              {
                id: modifier.id,
                name: modifier.name,
                groupName: group.name,
                priceAdjustment: Number(modifier.priceAdjustment || 0),
              },
            ])
          )
      );
      let unitPrice = menuItem.price;
      const selectedModifiers = incomingModifiers
        .map((modifier: any) => {
          const dbModifier = modifier?.id ? modifierMap.get(modifier.id) : null;
          if (!dbModifier) return null;
          unitPrice += dbModifier.priceAdjustment;
          return dbModifier;
        })
        .filter(Boolean);
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
        selectedModifiers,
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
          status: 'NEW' as any,
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
          diningSession: {
            include: {
              customer: true,
            },
          },
        },
      });

      // Update session status
      await tx.diningSession.update({
        where: { id: sessionId },
        data: { sessionStatus: 'ACTIVE' as any },
      });

      // Update table status
      if (session.tableId) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: 'ORDERING_OPEN' as any, currentOrderId: newOrder.id },
        });
      }

      return newOrder;
    });

    // Notify vendor dashboard + KDS
    getIO().to(getTenantRoom(tenant.id)).emit('order:new', order);
    getIO().to(getTenantRoom(tenant.id)).emit('session:update', {
      sessionId,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });

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
    if (['CLOSED', 'CANCELLED', 'AWAITING_BILL'].includes(session.sessionStatus)) {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    // Validate session has orders
    if (session.orders.length === 0) {
      return res.status(400).json({
        error: 'Cannot finish session with no orders',
        sessionId
      });
    }

    const hasUnservedOrders = session.orders.some(
      (order: any) => !['SERVED', 'RECEIVED'].includes(String(order.status || '').toUpperCase()),
    );
    if (hasUnservedOrders) {
      return res.status(409).json({
        error: 'Serve every active batch before generating the final bill.',
        sessionId,
      });
    }

    // Calculate bill from all non-cancelled orders
    const subtotal = session.orders.reduce((sum: number, o: any) => sum + o.subtotal, 0);
    const taxAmount = session.orders.reduce((sum: number, o: any) => sum + o.taxAmount, 0);

    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    // Check if bill already exists to prevent duplicate key error
    const existingBill = await prisma.bill.findUnique({
      where: { sessionId },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Create bill only if it doesn't exist
      if (!existingBill) {
        await tx.bill.create({
          data: {
            tenantId: tenant.id,
            sessionId,
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            invoiceNumber,
            businessName: tenant.businessName,
            businessAddress: tenant.address,
            gstin: (tenant as any).gstin,
            fssai: (tenant as any).fssai,
          } as any,
        });
      }

      // Update session status to AWAITING_BILL regardless
      const updatedSession = await tx.diningSession.update({
        where: { id: sessionId },
        data: {
          sessionStatus: 'AWAITING_BILL' as any,
          isBillGenerated: true,
          billGeneratedAt: existingBill ? undefined : new Date(),
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
    const tenantRoom = getTenantRoom(tenant.id);
    const sessionRoom = getSessionRoom(tenant.id, result.id);

    const finishedPayload = {
      sessionId: result.id,
      tableName: (result as any).table?.name,
      totalAmount: (result as any).bill?.totalAmount,
    };
    const sessionUpdatePayload = {
      sessionId: result.id,
      status: 'AWAITING_BILL',
      updatedAt: new Date().toISOString(),
    };

    getIO().to(tenantRoom).emit('session:finished', finishedPayload);
    getIO().to(sessionRoom).emit('session:finished', finishedPayload);
    getIO().to(tenantRoom).emit('session:update', sessionUpdatePayload);
    getIO().to(sessionRoom).emit('session:update', sessionUpdatePayload);
    if (result.tableId) {
      getIO().to(tenantRoom).emit('table:status_change', {
        tableId: result.tableId,
        status: 'AWAITING_BILL',
      });
    }

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
    const { tenantSlug, sessionId } = req.params;
    const requestedPaymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod.toLowerCase() : 'cash';
    const allowedPaymentMethods = new Set(['cash', 'online', 'upi', 'card']);

    if (!allowedPaymentMethods.has(requestedPaymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.diningSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          isBillGenerated: true,
          sessionStatus: true,
        },
      });

      if (!existingSession) {
        throw new Error('SESSION_NOT_FOUND');
      }

      if (existingSession.tenantId !== tenant.id) {
        throw new Error('SESSION_TENANT_MISMATCH');
      }

      if (existingSession.sessionStatus !== 'AWAITING_BILL') {
        throw new Error('SESSION_NOT_READY_FOR_PAYMENT');
      }

      const session = await tx.diningSession.update({
        where: { id: sessionId },
        data: {
          sessionStatus: 'CLOSED' as any,
          closedAt: new Date(),
        },
      });

      // Update bill payment
      if (session.isBillGenerated) {
        await tx.bill.updateMany({
          where: { sessionId },
          data: {
            paymentStatus: 'PAID',
            paymentMethod: requestedPaymentMethod,
            paidAt: new Date(),
          },
        });
      }

      // Mark all orders as completed
      await tx.order.updateMany({
        where: { diningSessionId: sessionId, status: { notIn: ['CANCELLED'] } },
        data: { status: 'RECEIVED' as any, completedAt: new Date() },
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

    const tenantRoom = getTenantRoom(result.tenantId);
    const sessionRoom = getSessionRoom(result.tenantId, result.id);

    const completedPayload = {
      sessionId: result.id,
      paymentMethod: requestedPaymentMethod,
      closedAt: result.closedAt || new Date().toISOString(),
    };
    const sessionUpdatePayload = {
      sessionId: result.id,
      status: 'CLOSED',
      updatedAt: new Date().toISOString(),
    };
    const bulkStatusPayload = {
      sessionId: result.id,
      status: 'RECEIVED',
      updatedAt: new Date().toISOString(),
    };

    getIO().to(tenantRoom).emit('session:completed', completedPayload);
    getIO().to(sessionRoom).emit('session:completed', completedPayload);
    getIO().to(tenantRoom).emit('session:update', sessionUpdatePayload);
    getIO().to(sessionRoom).emit('session:update', sessionUpdatePayload);
    getIO().to(tenantRoom).emit('orders:bulk_status', bulkStatusPayload);
    getIO().to(sessionRoom).emit('orders:bulk_status', bulkStatusPayload);
    if (result.tableId) {
      getIO().to(tenantRoom).emit('table:status_change', {
        tableId: result.tableId,
        status: 'AVAILABLE',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('completeSession error:', error);
    if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (error instanceof Error && error.message === 'SESSION_TENANT_MISMATCH') {
      return res.status(403).json({ error: 'Session does not belong to this restaurant' });
    }
    if (error instanceof Error && error.message === 'SESSION_NOT_READY_FOR_PAYMENT') {
      return res.status(409).json({ error: 'Generate the final bill before marking payment complete.' });
    }
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
        review: true,
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
        sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
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

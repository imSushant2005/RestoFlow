import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';
import { getCache, setCache, deleteCache, withCache } from '../services/cache.service';

const WAITER_CALL_TYPES = new Set(['WAITER', 'BILL', 'WATER', 'EXTRA', 'HELP']);
const ORDERABLE_SESSION_STATUSES = ['OPEN', 'PARTIALLY_SENT', 'ACTIVE'] as const;

const publicOrderSelect = {
  id: true,
  tenantId: true,
  tableId: true,
  diningSessionId: true,
  orderNumber: true,
  orderType: true,
  status: true,
  subtotal: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  customerName: true,
  customerPhone: true,
  createdAt: true,
  updatedAt: true,
  readyAt: true,
  servedAt: true,
  table: {
    select: {
      id: true,
      name: true,
      zone: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  diningSession: {
    select: {
      id: true,
      sessionStatus: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  },
  items: {
    select: {
      id: true,
      menuItemId: true,
      name: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      selectedModifiers: true,
      specialNote: true,
      menuItem: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  },
} as const;

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStarRating(value: unknown) {
  const parsed = readOptionalNumber(value);
  if (parsed === undefined) return undefined;
  return Math.round(parsed);
}

async function resolveTenantIdBySlug(tenantSlug: string) {
  return withCache(
    `tenant_id_by_slug_${tenantSlug}`,
    async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });

      if (!tenant) {
        throw new Error('Restaurant not found');
      }

      return tenant.id;
    },
    86400,
  );
}

async function resolveWaiterTableName(tenantId: string, tableId?: string) {
  if (!tableId) return 'Unknown Table';

  const table = await prisma.table.findFirst({
    where: {
      tenantId,
      OR: [
        { id: tableId },
        { name: { equals: tableId, mode: 'insensitive' } },
      ],
    },
    select: { name: true },
  });

  const tableName = table?.name || tableId;
  return tableName.toLowerCase().startsWith('table ') ? tableName : `Table ${tableName}`;
}

async function resolveTenantTableId(tenantId: string, tableInput: string) {
  const trimmed = tableInput.trim();
  if (!trimmed) return null;

  const tableById = await prisma.table.findFirst({
    where: { id: trimmed, tenantId },
    select: { id: true },
  });

  if (tableById) return tableById.id;

  const tableByName = await prisma.table.findFirst({
    where: {
      tenantId,
      name: { equals: trimmed, mode: 'insensitive' },
    },
    select: { id: true },
  });

  return tableByName?.id || null;
}

export const getPublicMenu = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    
    const cacheKey = `public_menu_${tenantSlug}`;
    
    const publicData = await withCache(cacheKey, async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        include: {
          categories: {
            where: { isVisible: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              menuItems: {
                where: { isAvailable: true },
                orderBy: { sortOrder: 'asc' },
                include: {
                  modifierGroups: {
                    include: {
                      modifiers: {
                        where: { isAvailable: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!tenant) throw new Error('Vendor not found');
      
      return {
        tenantId: tenant.id,
        name: tenant.businessName,          // alias used by customer frontend
        businessName: tenant.businessName,
        description: tenant.description || '',
        slug: tenant.slug,
        logoUrl: tenant.logoUrl || null,
        coverImageUrl: tenant.coverImageUrl || null,
        categories: tenant.categories,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
        taxRate: tenant.taxRate,
      };
    }, 1800); // 30-minute cache

    res.json(publicData);
  } catch (error) {
    const status = error instanceof Error && error.message === 'Vendor not found' ? 404 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to fetch menu' });
  }
};

export const resolveCustomDomain = async (req: Request, res: Response) => {
  try {
    const domain = req.query.domain as string;
    if (!domain) return res.status(400).json({ error: 'Domain missing' });

    const cacheKey = `custom_domain_res_${domain}`;
    const resolution = await withCache(cacheKey, async () => {
      const tenant = await prisma.tenant.findFirst({
        where: { website: { contains: domain } },
        select: { slug: true }
      });
      if (!tenant) throw new Error('Domain not mapped');
      return { success: true, slug: tenant.slug };
    }, 86400); // 24-hour resolution cache

    res.json(resolution);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Resolver failed' });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { sessionId, sessionToken, items, tableId, customerName, customerPhone } = req.body;
    const incomingSessionToken = readOptionalString(sessionId || sessionToken || null);
    const requestedTableInput = readOptionalString(tableId);
    const requestIdempotencyKey =
      readOptionalString(req.header('x-idempotency-key')) ||
      readOptionalString(req.body?.idempotencyKey);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, taxRate: true },
    });
    if (!tenant) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must include at least one item' });
    }

    if (requestIdempotencyKey) {
      const cachedResponse = await getCache<any>(`public_order_idempotency_${tenant.id}_${requestIdempotencyKey}`);
      if (cachedResponse) {
        return res.status(200).json(cachedResponse);
      }
    }

    let safeTableId: string | null = null;
    if (requestedTableInput) {
      safeTableId = await resolveTenantTableId(tenant.id, requestedTableInput);
      if (!safeTableId) {
        return res.status(400).json({
          error: 'Invalid table reference. Please scan the QR again and restart the table flow.',
          code: 'INVALID_TABLE',
        });
      }
    }

    let resolvedSession = incomingSessionToken
      ? await prisma.diningSession.findFirst({
          where: {
            id: incomingSessionToken,
            tenantId: tenant.id,
            sessionStatus: { in: ORDERABLE_SESSION_STATUSES as any },
          },
          select: {
            id: true,
            tableId: true,
            customerId: true,
            sessionStatus: true,
          },
        })
      : null;

    const staleSession =
      incomingSessionToken && !resolvedSession
        ? await prisma.diningSession.findFirst({
            where: {
              id: incomingSessionToken,
              tenantId: tenant.id,
            },
            select: {
              id: true,
              tableId: true,
              sessionStatus: true,
            },
          })
        : null;

    if (!safeTableId && staleSession?.tableId) {
      safeTableId = staleSession.tableId;
    }

    const isDineInTableFlow = Boolean(safeTableId || staleSession?.tableId);

    if (!resolvedSession && safeTableId) {
      resolvedSession = await prisma.diningSession.findFirst({
        where: {
          tenantId: tenant.id,
          tableId: safeTableId,
          sessionStatus: { in: ORDERABLE_SESSION_STATUSES as any },
        },
        orderBy: { openedAt: 'desc' },
        select: {
          id: true,
          tableId: true,
          customerId: true,
          sessionStatus: true,
        },
      });
    }

    if (!resolvedSession && isDineInTableFlow) {
      return res.status(409).json({
        error: 'Active table session required before ordering. Please restart from QR login and party size.',
        code: 'SESSION_REQUIRED',
        tableId: safeTableId,
        previousSessionStatus: staleSession?.sessionStatus || null,
      });
    }

    if (!resolvedSession) {
      const normalizedPhone =
        typeof customerPhone === 'string' && customerPhone.trim().length > 0
          ? customerPhone.trim()
          : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let customer = await prisma.customer.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true, isActive: true },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            phone: normalizedPhone,
            name: typeof customerName === 'string' && customerName.trim().length > 0 ? customerName.trim() : null,
          },
          select: { id: true, isActive: true },
        });
      }

      if (!customer.isActive) {
        return res.status(403).json({ error: 'Customer account is inactive.' });
      }

      resolvedSession = await prisma.diningSession.create({
        data: {
          tenantId: tenant.id,
          tableId: safeTableId,
          customerId: customer.id,
          partySize: 1,
          sessionStatus: 'OPEN' as any,
          source: 'public_order',
        },
        select: {
          id: true,
          tableId: true,
          customerId: true,
          sessionStatus: true,
        },
      });
    }

    const menuItemIds = items
      .map((item: any) => item?.menuItemId || item?.menuItem?.id)
      .filter((id: any) => typeof id === 'string');
    if (menuItemIds.length === 0) {
      return res.status(400).json({ error: 'Order must include valid menu item ids' });
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId: tenant.id, id: { in: menuItemIds } },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        modifierGroups: {
          select: {
            id: true,
            name: true,
            modifiers: {
              where: { isAvailable: true },
              select: {
                id: true,
                name: true,
                priceAdjustment: true,
              },
            },
          },
        },
      },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    let subtotal = 0;
    const orderItemsCreate = items.map((item: any) => {
      const menuItemId = item?.menuItemId || item?.menuItem?.id;
      const menuItem = menuMap.get(menuItemId);
      if (!menuItem) {
        throw new Error(`Menu item not found: ${menuItemId}`);
      }

      const modifiers = Array.isArray(item.selectedModifiers)
        ? item.selectedModifiers
        : Array.isArray(item.modifiers)
          ? item.modifiers
          : [];
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        throw new Error('Invalid item quantity');
      }

      let unitPrice = menuItem.price;
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

      const selectedMods = modifiers.map((mod: any) => {
        const dbModifier = mod?.id ? modifierMap.get(mod.id) : null;
        if (!dbModifier) return null;
        unitPrice += dbModifier.priceAdjustment;
        return {
          id: dbModifier.id,
          name: dbModifier.name,
          groupName: dbModifier.groupName,
          priceAdjustment: dbModifier.priceAdjustment,
        };
      }).filter(Boolean);
      const totalPrice = unitPrice * quantity;
      subtotal += totalPrice;
      
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        description: menuItem.description || '',
        imageUrl: menuItem.images?.[0] || null,
        unitPrice,
        quantity,
        totalPrice,
        specialNote: item.notes || '',
        selectedModifiers: selectedMods
      };
    });

    const taxAmount = subtotal * (tenant.taxRate / 100);
    const totalAmount = subtotal + taxAmount;
    const orderType = safeTableId ? 'DINE_IN' : 'TAKEAWAY';
    
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let orderNumber = '';
    let exists = true;
    while (exists) {
      orderNumber = `#${Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
      const check = await prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber } });
      exists = !!check;
    }

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          diningSessionId: resolvedSession.id,
          tenantId: tenant.id,
          tableId: safeTableId || resolvedSession.tableId,
          customerName,
          customerPhone,
          orderNumber,
          orderType: orderType as any,
          subtotal,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          items: {
            create: orderItemsCreate,
          },
        },
        select: publicOrderSelect,
      });

      await tx.diningSession.update({
        where: { id: resolvedSession.id },
        data: { sessionStatus: 'ACTIVE' as any },
      });

      const tableIdToUpdate = safeTableId || resolvedSession.tableId || null;
      if (tableIdToUpdate) {
        await tx.table.update({
          where: { id: tableIdToUpdate },
          data: {
            status: 'ORDERING_OPEN',
            currentOrderId: createdOrder.id,
            currentSessionId: resolvedSession.id,
          },
        });
      }

      return createdOrder;
    });

    const tableIdToUpdate = safeTableId || resolvedSession.tableId || null;

    getIO().to(getTenantRoom(tenant.id)).emit('order:new', order);
    getIO().to(getSessionRoom(tenant.id, resolvedSession.id)).emit('order:new', order);
    getIO().to(getTenantRoom(tenant.id)).emit('session:update', {
      sessionId: resolvedSession.id,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });
    getIO().to(getSessionRoom(tenant.id, resolvedSession.id)).emit('session:update', {
      sessionId: resolvedSession.id,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });
    if (tableIdToUpdate) {
      getIO().to(getTenantRoom(tenant.id)).emit('table:status_change', {
        tableId: tableIdToUpdate,
        status: 'ORDERING_OPEN',
        orderNumber,
      });
    }

    await Promise.all([
      deleteCache(`session_orders_${resolvedSession.id}`),
      requestIdempotencyKey
        ? setCache(`public_order_idempotency_${tenant.id}_${requestIdempotencyKey}`, {
            ...order,
            sessionId: resolvedSession.id,
            diningSessionId: resolvedSession.id,
          }, 600)
        : Promise.resolve(),
    ]);

    return res.status(201).json({
      ...order,
      sessionId: resolvedSession.id,
      diningSessionId: resolvedSession.id,
    });
  } catch (error) {
    console.error('createOrder error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order';
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Failed to create order' : message
    });
  }
};

export const getOrderInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Cache for 2 minutes since orders don't change status *that* frequently 
    // and live updates are handled by Socket.io anyway.
    const cacheKey = `order_info_${id}`;
    const cachedOrder = await getCache(cacheKey);
    if (cachedOrder) return res.json(cachedOrder);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { table: true, items: { include: { menuItem: true } } }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    await setCache(cacheKey, order, 120);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

export const getSessionOrders = async (req: Request, res: Response) => {
  try {
    const { tenantSlug, sessionToken } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true }
    });
    if (!tenant) return res.status(404).json({ error: 'Vendor not found' });

    const cacheKey = `session_orders_${sessionToken}`;
    const cachedOrders = await getCache(cacheKey);
    if (cachedOrders) return res.json(cachedOrders);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        diningSessionId: sessionToken,
      },
      include: { table: true, items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Parse JSON modifiers before sending
    const parsedOrders = orders.map(o => ({
      ...o,
      items: o.items.map(i => ({
        ...i,
        modifiers: typeof i.selectedModifiers === 'string' ? JSON.parse(i.selectedModifiers) : i.selectedModifiers
      }))
    }));
    
    await setCache(cacheKey, parsedOrders, 30); // 30-second cache
    res.json(parsedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session orders' });
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const overallRating = normalizeStarRating(req.body?.overallRating ?? req.body?.rating);
    const foodRating = normalizeStarRating(req.body?.foodRating);
    const serviceRating = normalizeStarRating(req.body?.serviceRating);
    const comment = readOptionalString(req.body?.comment) ?? readOptionalString(req.body?.feedback);
    const tipAmount = readOptionalNumber(req.body?.tipAmount) ?? 0;
    const requestedStaffName = readOptionalString(req.body?.serviceStaffName);
    const ratingValues = [overallRating, foodRating, serviceRating].filter(
      (value): value is number => Number.isFinite(value),
    );

    if (ratingValues.length === 0) {
      return res.status(400).json({ error: 'At least one rating is required' });
    }

    if (ratingValues.some((value) => value < 1 || value > 5)) {
      return res.status(400).json({ error: 'Ratings must be between 1 and 5' });
    }

    if (tipAmount < 0) {
      return res.status(400).json({ error: 'Tip amount cannot be negative' });
    }

    const derivedOverallRating =
      overallRating ??
      Math.max(1, Math.min(5, Math.round(ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length)));

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        diningSessionId: true,
        status: true,
        diningSession: {
          select: {
            id: true,
            customerId: true,
            sessionStatus: true,
            attendedByName: true,
            attendedByUserId: true,
            bill: {
              select: {
                paymentStatus: true,
              },
            },
          },
        },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.diningSessionId) {
      const sessionStatus = String(order.diningSession?.sessionStatus || '').toUpperCase();
      const paymentStatus = String(order.diningSession?.bill?.paymentStatus || '').toUpperCase();
      if (sessionStatus !== 'CLOSED' || paymentStatus !== 'PAID') {
        return res.status(409).json({ error: 'Review is available only after payment is settled.' });
      }
    } else if (String(order.status || '').toUpperCase() !== 'RECEIVED') {
      return res.status(409).json({ error: 'Review is available only after the order is completed.' });
    }

    const resolvedServiceStaffName = requestedStaffName || order.diningSession?.attendedByName || undefined;
    const resolvedServiceStaffUserId = order.diningSession?.attendedByUserId || undefined;

    // Keep feedback idempotent across the whole dining session.
    // A session allows only one review row, while multiple orders may exist.
    const existingSessionReview = await prisma.review.findFirst({
      where: order.diningSessionId ? { diningSessionId: order.diningSessionId } : { orderId: order.id },
      select: { id: true, orderId: true },
    });

    if (existingSessionReview) {
      const review = await prisma.review.update({
        where: { id: existingSessionReview.id },
        data: {
          overallRating: derivedOverallRating,
          foodRating: foodRating ?? derivedOverallRating,
          serviceRating: serviceRating ?? derivedOverallRating,
          comment,
          tipAmount,
          serviceStaffName: resolvedServiceStaffName,
          serviceStaffUserId: resolvedServiceStaffUserId,
          ...(existingSessionReview.orderId ? {} : { orderId: order.id }),
        },
      });
      if (order.diningSessionId) {
        await prisma.order.updateMany({
          where: { diningSessionId: order.diningSessionId, status: { not: 'CANCELLED' as any } },
          data: { hasReview: true },
        });
      } else {
        await prisma.order.update({
          where: { id },
          data: { hasReview: true },
        });
      }

      return res.json({ success: true, review });
    } else {
      const review = await prisma.review.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          diningSessionId: order.diningSessionId,
          customerId: order.diningSession?.customerId,
          overallRating: derivedOverallRating,
          foodRating: foodRating ?? derivedOverallRating,
          serviceRating: serviceRating ?? derivedOverallRating,
          comment,
          tipAmount,
          serviceStaffName: resolvedServiceStaffName,
          serviceStaffUserId: resolvedServiceStaffUserId,
        },
      });
      if (order.diningSessionId) {
        await prisma.order.updateMany({
          where: { diningSessionId: order.diningSessionId, status: { not: 'CANCELLED' as any } },
          data: { hasReview: true },
        });
      } else {
        await prisma.order.update({
          where: { id },
          data: { hasReview: true },
        });
      }

      return res.json({ success: true, review });
    }
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

export const waiterCall = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const tableId = readOptionalString(req.body?.tableId);
    const sessionId = readOptionalString(req.body?.sessionId);
    const type = readOptionalString(req.body?.type)?.toUpperCase() || 'WAITER';

    if (!WAITER_CALL_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid waiter call type' });
    }

    const tenantId = await resolveTenantIdBySlug(tenantSlug);
    const tableName = await resolveWaiterTableName(tenantId, tableId);
    const payload = {
      tableId,
      tableName,
      type,
      sessionId,
      timestamp: new Date().toISOString(),
    };

    getIO().to(getTenantRoom(tenantId)).emit('waiter:call', payload);

    res.json({ success: true, table: tableName, sessionId });
  } catch (error) {
    console.error('waiterCall error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(message === 'Restaurant not found' ? 404 : 500).json({ error: message });
  }
};

/**
 * Staff Acknowledgment of a waiter call.
 * This notifies the specific guest that help is arriving.
 */
export const acknowledgeWaiterCall = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const sessionId = readOptionalString(req.body?.sessionId);
    const tableId = readOptionalString(req.body?.tableId);

    if (!sessionId) {
      return res.status(400).json({ error: 'Session or guest token is required' });
    }

    const tenantId = await resolveTenantIdBySlug(tenantSlug);
    const sessionRoom = getSessionRoom(tenantId, sessionId);
    getIO().to(sessionRoom).emit('waiter:acknowledged', {
      tableId,
      status: 'ACCEPTED',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('acknowledgeWaiterCall error:', error);
    const message = error instanceof Error ? error.message : 'Failed to notify guest';
    res.status(message === 'Restaurant not found' ? 404 : 500).json({ error: message });
  }
};

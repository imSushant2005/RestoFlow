import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';
import { getCache, setCache, deleteCache } from '../services/cache.service';

export const getPublicMenu = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    
    const cacheKey = `public_menu_${tenantSlug}`;
    const cachedMenu = await getCache(cacheKey);
    // Bust cache if it's missing the `name` field (old format)
    if (cachedMenu && cachedMenu.name) return res.json(cachedMenu);
    if (cachedMenu && !cachedMenu.name) await deleteCache(cacheKey);

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

    if (!tenant) return res.status(404).json({ error: 'Vendor not found' });
    
    const publicData = {
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

    await setCache(cacheKey, publicData, 3600); // 1-hour cache

    res.json(publicData);
  } catch (error) {
    console.error('getPublicMenu error:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
};

export const resolveCustomDomain = async (req: Request, res: Response) => {
  try {
    const domain = req.query.domain as string;
    if (!domain) return res.status(400).json({ error: 'Domain missing' });

    // In a prod system, you'd match against a specific `customDomain` field.
    // For V3 upgrade, we map against the `website` URL field dynamically.
    const tenant = await prisma.tenant.findFirst({
      where: { website: { contains: domain } },
      select: { slug: true }
    });

    if (!tenant) return res.status(404).json({ error: 'Domain not mapped to any tenant' });

    res.json({ success: true, slug: tenant.slug });
  } catch (error) {
    res.status(500).json({ error: 'Resolver failed' });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { sessionId, sessionToken, items, tableId, customerName, customerPhone } = req.body;
    const incomingSessionToken = sessionId || sessionToken || null;

    console.log(`[PUBLIC_ORDER] Start createOrder for tenant: ${tenantSlug}`);
    console.log(`[PUBLIC_ORDER] Payload:`, { 
      itemsCount: items?.length, 
      tableId, 
      hasSession: !!incomingSessionToken,
      customerName,
      customerPhone 
    });
    
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      console.warn(`[PUBLIC_ORDER] Tenant not found: ${tenantSlug}`);
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.warn(`[PUBLIC_ORDER] Empty order items for tenant: ${tenantSlug}`);
      return res.status(400).json({ error: 'Order must include at least one item' });
    }

    let safeTableId: string | null = null;
    if (tableId) {
      const table = await prisma.table.findFirst({
        where: {
          id: tableId,
          tenantId: tenant.id
        },
        select: { id: true }
      });
      safeTableId = table?.id || null;
      if (!safeTableId) {
        console.warn(`[PUBLIC_ORDER] Invalid tableId ${tableId} for tenant ${tenant.id}`);
      }
    }

    let resolvedSession = incomingSessionToken
      ? await prisma.diningSession.findFirst({
          where: {
            id: incomingSessionToken,
            tenantId: tenant.id,
            sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
          },
        })
      : null;

    if (incomingSessionToken && !resolvedSession) {
      console.log(`[PUBLIC_ORDER] Provided session token ${incomingSessionToken} is invalid or closed. Attempting to resolve by table...`);
    }

    // If caller didn't pass a sessionId, try joining the active table session first.
    if (!resolvedSession && safeTableId) {
      resolvedSession = await prisma.diningSession.findFirst({
        where: {
          tenantId: tenant.id,
          tableId: safeTableId,
          sessionStatus: { notIn: ['CLOSED' as any, 'CANCELLED' as any] },
        },
        orderBy: { openedAt: 'desc' },
      });
      if (resolvedSession) {
        console.log(`[PUBLIC_ORDER] Joined active session ${resolvedSession.id} at table ${safeTableId}`);
      }
    }

    // Always anchor orders to a DiningSession (legacy CustomerSession removed from runtime flow).
    if (!resolvedSession) {
      console.log(`[PUBLIC_ORDER] No active session found. Creating new guest session...`);
      const normalizedPhone =
        typeof customerPhone === 'string' && customerPhone.trim().length > 0
          ? customerPhone.trim()
          : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let customer = await prisma.customer.findUnique({ where: { phone: normalizedPhone } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            phone: normalizedPhone,
            name: typeof customerName === 'string' && customerName.trim().length > 0 ? customerName.trim() : null,
          },
        });
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
      });
      console.log(`[PUBLIC_ORDER] Created NEW session ${resolvedSession.id} for guest ${normalizedPhone}`);
    }

    const menuItemIds = items
      .map((item: any) => item?.menuItemId || item?.menuItem?.id)
      .filter((id: any) => typeof id === 'string');
    if (menuItemIds.length === 0) {
      return res.status(400).json({ error: 'Order must include valid menu item ids' });
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId: tenant.id, id: { in: menuItemIds } },
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
    
    // Generate order number
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let orderNumber = '';
    let exists = true;
    while(exists) {
      orderNumber = '#' + Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const check = await prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber } });
      exists = !!check;
    }

    let order;
    try {
      order = await prisma.order.create({
        data: {
          diningSessionId: resolvedSession.id,
          tenantId: tenant.id,
          tableId: safeTableId || resolvedSession.tableId,
          customerName,
          customerPhone,
          orderNumber,
          subtotal,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          items: {
            create: orderItemsCreate
          }
        },
        include: {
          table: true,
          diningSession: {
            include: {
              customer: true,
            },
          },
          items: {
            include: {
              menuItem: true,
            },
          },
        }
      });
    } catch (primaryCreateError) {
      console.error('createOrder primary create error:', primaryCreateError);
      order = await prisma.order.create({
        data: {
          diningSessionId: resolvedSession.id,
          tableId: safeTableId || resolvedSession.tableId,
          tenantId: tenant.id,
          customerName,
          customerPhone,
          orderNumber,
          subtotal,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          items: {
            create: orderItemsCreate.map((item) => ({
              ...item,
              menuItemId: null
            }))
          }
        },
        include: {
          table: true,
          diningSession: {
            include: {
              customer: true,
            },
          },
          items: {
            include: {
              menuItem: true,
            },
          },
        }
      });
    }

    // Table-sync failure should never turn a successful order into a client-visible 500.
    const tableIdToUpdate = safeTableId || resolvedSession.tableId || null;
    if (tableIdToUpdate) {
      try {
        await prisma.table.update({
          where: { id: tableIdToUpdate },
          data: { status: 'ORDERING_OPEN', currentOrderId: order.id, currentSessionId: resolvedSession.id }
        });
        getIO().to(getTenantRoom(tenant.id)).emit('table:status_change', { tableId: tableIdToUpdate, status: 'ORDERING_OPEN', orderNumber });
      } catch (tableError) {
        console.error('createOrder table sync error:', tableError);
      }
    }

    await prisma.diningSession.update({
      where: { id: resolvedSession.id },
      data: { sessionStatus: 'ACTIVE' as any },
    });

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

    res.status(201).json({
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
    const { rating, feedback } = req.body;
    const parsedRating = Number(rating);

    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Keep feedback idempotent across the whole dining session.
    // A session allows only one review row, while multiple orders may exist.
    const existingSessionReview = order.diningSessionId
      ? await prisma.review.findFirst({
          where: { diningSessionId: order.diningSessionId },
          select: { id: true, orderId: true },
        })
      : null;

    if (existingSessionReview) {
      await prisma.review.update({
        where: { id: existingSessionReview.id },
        data: {
          overallRating: parsedRating,
          comment: feedback,
          ...(existingSessionReview.orderId ? {} : { orderId: order.id }),
        },
      });
    } else {
      await prisma.review.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          diningSessionId: order.diningSessionId,
          overallRating: parsedRating,
          comment: feedback,
        },
      });
    }

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

    res.json({ success: true });
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

export const waiterCall = async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { tableId, type } = req.body; // type: WAITER | BILL | HELP

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });

    let tableName = 'Unknown';
    if (tableId) {
      const table = await prisma.table.findUnique({ where: { id: tableId } });
      if (table) tableName = table.name;
    }

    // Emit to dashboard and KDS via Socket.io
    getIO().to(getTenantRoom(tenant.id)).emit('waiter:call', {
      tableId,
      tableName,
      type: type || 'WAITER',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('waiterCall error:', error);
    res.status(500).json({ error: 'Failed to send waiter call' });
  }
};

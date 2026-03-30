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
      accentColor: tenant.accentColor
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
    
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return res.status(404).json({ error: 'Vendor not found' });
    if (!Array.isArray(items) || items.length === 0) {
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
    }

    let resolvedSessionId: string | null = null;
    if (incomingSessionToken) {
      let session = await prisma.customerSession.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { id: incomingSessionToken },
            { anonymousId: incomingSessionToken }
          ]
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true }
      });

      if (!session) {
        try {
          session = await prisma.customerSession.create({
            data: {
              tenantId: tenant.id,
              tableId: safeTableId,
              anonymousId: incomingSessionToken,
            },
            select: { id: true }
          });
        } catch (sessionCreateError) {
          console.error('createOrder session create error:', sessionCreateError);
        }
      }

      resolvedSessionId = session?.id || null;
    }

    let subtotal = 0;
    const orderItemsCreate = items.map((item: any) => {
      const menuItem = item?.menuItem;
      if (!menuItem?.id || typeof menuItem.price !== 'number') {
        throw new Error('Invalid menu item payload');
      }

      const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        throw new Error('Invalid item quantity');
      }

      let unitPrice = menuItem.price;
      const selectedMods = modifiers.map((mod: any) => {
        unitPrice += mod.priceAdjustment || mod.price || 0;
        return {
          id: mod.id,
          name: mod.name,
          priceAdjustment: mod.priceAdjustment || mod.price || 0,
        };
      });
      const totalPrice = unitPrice * quantity;
      subtotal += totalPrice;
      
      return {
        menuItemId: menuItem.id,
        name: menuItem.name || 'Item',
        description: menuItem.description || '',
        imageUrl: menuItem.imageUrl || null,
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
          sessionId: resolvedSessionId,
          tenantId: tenant.id,
          tableId: safeTableId,
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
        include: { table: true, items: { include: { menuItem: true } } }
      });
    } catch (primaryCreateError) {
      console.error('createOrder primary create error:', primaryCreateError);
      order = await prisma.order.create({
        data: {
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
        include: { table: true, items: { include: { menuItem: true } } }
      });
    }

    // Table-sync failure should never turn a successful order into a client-visible 500.
    if (safeTableId) {
      try {
        await prisma.table.update({
          where: { id: safeTableId },
          data: { status: 'OCCUPIED', currentOrderId: order.id }
        });
        getIO().to(getTenantRoom(tenant.id)).emit('table:status_change', { tableId: safeTableId, status: 'OCCUPIED', orderNumber });
      } catch (tableError) {
        console.error('createOrder table sync error:', tableError);
      }
    }

    getIO().to(getTenantRoom(tenant.id)).emit('order:new', order);
    if (incomingSessionToken) {
      getIO().to(getSessionRoom(tenant.id, incomingSessionToken)).emit('order:new', order);
    }
    if (resolvedSessionId && resolvedSessionId !== incomingSessionToken) {
      getIO().to(getSessionRoom(tenant.id, resolvedSessionId)).emit('order:new', order);
    }

    res.status(201).json(order);
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

    const matchingSessions = await prisma.customerSession.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { id: sessionToken },
          { anonymousId: sessionToken }
        ]
      },
      select: { id: true }
    });

    const sessionIds = [...new Set([sessionToken, ...matchingSessions.map((session) => session.id)])];
    
    const cacheKey = `session_orders_${sessionToken}`;
    const cachedOrders = await getCache(cacheKey);
    if (cachedOrders) return res.json(cachedOrders);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        sessionId: { in: sessionIds }
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

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // V2 uses Review table instead of tying directly to Order
    await prisma.review.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        sessionId: order.sessionId,
        overallRating: rating,
        comment: feedback,
      }
    });

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { hasReview: true },
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

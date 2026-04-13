import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

function resolveScopedTenantSlug(req: Request) {
  const queryTenantSlug =
    typeof req.query.tenantSlug === 'string' && req.query.tenantSlug.trim().length > 0
      ? req.query.tenantSlug.trim()
      : null;
  const tokenTenantSlug = ((req as any).customerTenantSlug as string | null) || null;

  if (queryTenantSlug && tokenTenantSlug && queryTenantSlug !== tokenTenantSlug) {
    throw new Error('CUSTOMER_TENANT_SCOPE_MISMATCH');
  }

  return queryTenantSlug || tokenTenantSlug || null;
}

/**
 * POST /customer/login
 * Login with phone + name (no OTP for MVP)
 * Creates customer if not exists, returns JWT
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { phone, name, tenantSlug } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    // Optimization: Parallelize tenant lookup and customer identification
    const [customer, tenant] = await Promise.all([
      (async () => {
        let c = await prisma.customer.findUnique({ where: { phone } });
        if (c) {
          if (!c.isActive) {
            throw new Error('CUSTOMER_DEACTIVATED');
          }
          return prisma.customer.update({
            where: { id: c.id },
            data: { lastSeenAt: new Date(), ...(name && { name }) },
          });
        }
        return prisma.customer.create({
          data: { phone, name: name || null },
        });
      })(),
      tenantSlug ? prisma.tenant.findUnique({
        where: { slug: tenantSlug.trim() },
        select: { id: true },
      }) : Promise.resolve(null)
    ]);

    if (tenantSlug && !tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }


    // Generate JWT
    const token = jwt.sign(
      { customerId: customer.id, phone: customer.phone, tenantSlug: tenantSlug?.trim() || null },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );


    res.json({
      token,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CUSTOMER_DEACTIVATED') {
      return res.status(403).json({ error: 'This customer account has been deactivated.' });
    }
    console.error('Customer login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * GET /customer/profile
 * Get customer profile (requires customer JWT)
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        isActive: true,
        deactivatedAt: true,
        anonymizedAt: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json(customer);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const deactivateAccount = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (!customer.isActive) {
      return res.json({ success: true, message: 'Account already deactivated.' });
    }

    const anonymizedPhone = `deactivated_${customer.id}`;

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        anonymizedAt: new Date(),
        phone: anonymizedPhone,
        name: 'Deleted customer',
        email: null,
      },
    });

    return res.json({
      success: true,
      message: 'Customer account deactivated and personal data anonymized.',
    });
  } catch (error) {
    console.error('deactivateAccount error:', error);
    return res.status(500).json({ error: 'Failed to deactivate account' });
  }
};

/**
 * GET /customer/history
 * Get all completed dining sessions with orders + bills
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const scopedTenantSlug = resolveScopedTenantSlug(req);

    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    let tenantIdFilter: string | null = null;
    if (scopedTenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: scopedTenantSlug },
        select: { id: true },
      });
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      tenantIdFilter = tenant.id;
    }

    const sessions = await prisma.diningSession.findMany({
      where: {
        customerId,
        ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
        sessionStatus: 'CLOSED' as any,
      },
      include: {
        tenant: {
          select: { businessName: true, slug: true, logoUrl: true },
        },
        table: { select: { name: true } },
        bill: true,
        orders: {
          include: {
            items: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        review: {
          select: {
            overallRating: true,
            foodRating: true,
            serviceRating: true,
            comment: true,
            tipAmount: true,
            serviceStaffName: true,
          },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });

    res.json(sessions);
  } catch (error) {
    console.error('getHistory error:', error);
    if (error instanceof Error && error.message === 'CUSTOMER_TENANT_SCOPE_MISMATCH') {
      return res.status(403).json({ error: 'Customer token is not valid for this restaurant scope' });
    }
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

/**
 * GET /customer/history/:sessionId
 * Get a single session detail with full bill + orders
 */
export const getSessionDetail = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { sessionId } = req.params;
    const scopedTenantSlug = resolveScopedTenantSlug(req);

    if (!customerId) return res.status(401).json({ error: 'Not authenticated' });

    let tenantIdFilter: string | null = null;
    if (scopedTenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: scopedTenantSlug },
        select: { id: true },
      });
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      tenantIdFilter = tenant.id;
    }

    const session = await prisma.diningSession.findFirst({
      where: { id: sessionId, customerId, ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}) },
      include: {
        tenant: {
          select: { businessName: true, slug: true, logoUrl: true, taxRate: true, currency: true, currencySymbol: true },
        },
        table: { select: { name: true } },
        bill: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        review: true,
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json(session);
  } catch (error) {
    console.error('getSessionDetail error:', error);
    if (error instanceof Error && error.message === 'CUSTOMER_TENANT_SCOPE_MISMATCH') {
      return res.status(403).json({ error: 'Customer token is not valid for this restaurant scope' });
    }
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

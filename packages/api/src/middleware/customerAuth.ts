import { Request, Response, NextFunction } from 'express';
import { prisma, withPrismaRetry } from '../db/prisma';
import { verifyCustomerAccessToken } from '../utils/public-access';

/**
 * Middleware to authenticate customer JWT tokens.
 * Sets req.customerId if valid.
 */
export const customerAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Customer authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyCustomerAccessToken(token);

    const customer = await withPrismaRetry(
      () =>
        prisma.customer.findUnique({
          where: { id: decoded.customerId },
          select: { id: true, isActive: true },
        }),
      `customer-auth:${decoded.customerId}`,
    );

    if (!customer || !customer.isActive) {
      return res.status(403).json({ error: 'Customer account is inactive' });
    }

    (req as any).customerId = decoded.customerId;
    (req as any).customerPhone = decoded.phone;
    (req as any).customerTenantSlug = decoded.tenantSlug || null;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired customer token' });
  }
};

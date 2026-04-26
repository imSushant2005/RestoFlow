import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserRole } from '@bhojflow/prisma';
import { prisma } from '../db/prisma';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        tenantId: true,
        role: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Account is inactive' });
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
    req.tenantId = user.tenantId; // Enforces tenant isolation scoping
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User role not found' });
    }
    
    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }
    
    next();
  };
};

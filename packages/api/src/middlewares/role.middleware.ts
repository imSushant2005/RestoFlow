import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@dineflow/prisma';

export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Superuser Bypass
    if (req.user.email === 'sushantrana2005@gmail.com') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

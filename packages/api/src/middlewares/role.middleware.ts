import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@bhojflow/prisma';
import { env } from '../config/env';

const experimentAdminEmails = new Set(
  ['sushantrana2005@gmail.com', ...(env.EXPERIMENT_ADMIN_EMAILS || [])]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean),
);

export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (experimentAdminEmails.has(String(req.user.email || '').trim().toLowerCase())) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

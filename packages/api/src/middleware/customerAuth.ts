import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * Middleware to authenticate customer JWT tokens.
 * Sets req.customerId if valid.
 */
export const customerAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Customer authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { customerId: string; phone: string };

    (req as any).customerId = decoded.customerId;
    (req as any).customerPhone = decoded.phone;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired customer token' });
  }
};

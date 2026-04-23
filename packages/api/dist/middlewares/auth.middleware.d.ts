import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@bhojflow/prisma';
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireRole: (allowedRoles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.middleware.d.ts.map
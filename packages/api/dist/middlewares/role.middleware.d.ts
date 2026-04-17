import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@dineflow/prisma';
export declare const requireRoles: (roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=role.middleware.d.ts.map
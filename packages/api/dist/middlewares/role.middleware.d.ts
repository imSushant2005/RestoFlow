import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@dineflow/prisma';
export declare const requireRoles: (roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=role.middleware.d.ts.map
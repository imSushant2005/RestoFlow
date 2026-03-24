import { Role } from '@dineflow/prisma';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: Role;
      };
      tenantId?: string;
    }
  }
}

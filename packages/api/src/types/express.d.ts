import { UserRole } from '@bhojflow/prisma';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: UserRole;
        email: string;
      };
      tenantId?: string;
    }
  }
}

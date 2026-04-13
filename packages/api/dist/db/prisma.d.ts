import { PrismaClient } from '@dineflow/prisma';
export declare const prisma: PrismaClient<import("@dineflow/prisma").Prisma.PrismaClientOptions, never, import("@dineflow/prisma/src/generated/client/runtime/library").DefaultArgs>;
export declare function withPrismaRetry<T>(operation: () => Promise<T>, label?: string, maxRetries?: number): Promise<T>;
export declare function checkPrismaReadiness(timeoutMs?: number): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map
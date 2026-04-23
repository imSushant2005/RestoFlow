import { PrismaClient } from '@bhojflow/prisma';
export declare const prisma: PrismaClient<import("@bhojflow/prisma").Prisma.PrismaClientOptions, never, import("@bhojflow/prisma/src/generated/client/runtime/library").DefaultArgs>;
export declare function withPrismaRetry<T>(operation: () => Promise<T>, label?: string, maxRetries?: number): Promise<T>;
export declare function checkPrismaReadiness(timeoutMs?: number): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map
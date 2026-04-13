export declare const getCache: <T = any>(key: string) => Promise<T | null>;
export declare const setCache: (key: string, value: any, ttlSeconds?: number) => Promise<void>;
export declare const deleteCache: (pattern: string) => Promise<void>;
/**
 * Executes a fallback function if cache miss, otherwise returns cached value.
 */
export declare function withCache<T>(key: string, fallback: () => Promise<T>, ttlSeconds?: number): Promise<T>;
//# sourceMappingURL=cache.service.d.ts.map
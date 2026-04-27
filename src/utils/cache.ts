import NodeCache from "node-cache";

// Default TTL will be overridden by config after initialization
const cache = new NodeCache({
  stdTTL: parseInt(process.env.USER_CACHE_TTL_SECONDS || "60", 10),
  checkperiod: 120,
  useClones: false,
});

export const cacheService = {
  get<T>(key: string): T | undefined {
    return cache.get<T>(key);
  },

  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl !== undefined) {
      return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
  },

  del(key: string): number {
    return cache.del(key);
  },

  flush(): void {
    cache.flushAll();
  },
};

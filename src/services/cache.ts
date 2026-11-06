import { Cache } from "@cloudflare/workers-types/experimental";

import { Cache } from "@cloudflare/workers-types/experimental";

export interface CacheService {
  get(key: string): Promise<Response | null>;
  put(key: string, response: Response, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class WorkersCache implements CacheService {
  private readonly cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  async get(key: string): Promise<Response | null> {
    return this.cache.match(key);
  }

  async put(key: string, response: Response, ttlSeconds: number): Promise<void> {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);

    const clone = response.clone();
    await this.cache.put(key, new Response(clone.body, {
      status: clone.status,
      statusText: clone.statusText,
      headers,
    }));
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }
}

export class MemoryCache implements CacheService {
  private readonly store = new Map<string, { response: Response; expiry: number }>();

  async get(key: string): Promise<Response | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.response.clone();
  }

  async put(key: string, response: Response, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      response: response.clone(),
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export function cacheKey(projectId: string, suffix: string): string {
  return `omversions:${projectId}:${suffix}`;
}

export function defaultTtl(env: { RELEASE_CACHE_TTL?: string }): number {
  const raw = env.RELEASE_CACHE_TTL;
  if (!raw) return 300;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

export function createCacheService(env: { RELEASE_CACHE_TTL?: string }): CacheService {
  const cachesStorage = (globalThis as unknown as { caches?: { default?: unknown } }).caches;
  if (cachesStorage?.default) {
    return new WorkersCache(cachesStorage.default as Cache);
  }
  return new MemoryCache();
}

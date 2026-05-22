import { redis } from "../lib/redis";

export async function cacheGet(key: string): Promise<any | null> {
  try {
    const v = await redis.get(key);
    if (v == null) return null;
    try {
      return JSON.parse(v as string);
    } catch (e) {
      return v;
    }
  } catch (err) {
    console.warn("Cache get error:", err);
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  try {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    // Upstash REST supports EX option
    await redis.set(key, v, { ex: ttlSeconds });
  } catch (err) {
    console.warn("Cache set error:", err);
  }
}

export async function cacheGetOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
  const cached = await cacheGet(key);
  if (cached != null) {
    console.log(`[cache] HIT: ${key}`);
    return cached as T;
  }
  console.log(`[cache] MISS: ${key}`);
  const fresh = await fetchFn();
  try {
    await cacheSet(key, fresh, ttlSeconds);
  } catch (e) {
    // ignore cache set errors
  }
  return fresh;
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
    console.log(`[cache] DELETE: ${key}`);
  } catch (err) {
    console.warn("Cache delete error:", err);
  }
}

export async function cacheInvalidateProducts(): Promise<void> {
  try {
    // Invalidate all product list and homepage/category cache keys.
    await Promise.all([
      cacheDelete("products:{}"),
      cacheDelete("products:{\"active\":\"true\"}"),
      cacheDelete("products:{\"active\":\"false\"}"),
      cacheDelete("homepage_products"),
      cacheDelete("categories"),
    ]);
    console.log(`[cache] Invalidated product and storefront caches`);
  } catch (err) {
    console.warn("Cache invalidation error:", err);
  }
}

export async function cacheInvalidateProduct(slug: string): Promise<void> {
  try {
    await cacheDelete(`product:${slug}`);
    // Also invalidate the products list and storefront caches because a product changed
    await cacheInvalidateProducts();
  } catch (err) {
    console.warn("Cache invalidation error:", err);
  }
}

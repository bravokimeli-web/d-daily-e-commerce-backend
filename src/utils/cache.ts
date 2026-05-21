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
  if (cached != null) return cached as T;
  const fresh = await fetchFn();
  try {
    await cacheSet(key, fresh, ttlSeconds);
  } catch (e) {
    // ignore cache set errors
  }
  return fresh;
}

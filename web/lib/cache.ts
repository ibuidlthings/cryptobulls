// Simple TTL-keyed in-memory cache. Lives in the Next.js server runtime.
// Used to cache rendered PNG/SVG bytes + chain reads so repeated hits don't
// re-render or re-RPC.
//
// Not LRU — Map of tier -> { entry, expiresAt }. Bounded by MAX_BULLS (1000)
// so the worst-case memory is ~25MB (1000 * ~25KB PNG). Evicts only on TTL.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const stores: Record<string, Map<string, CacheEntry<unknown>>> = {};

export function cacheGet<T>(store: string, key: string): T | undefined {
  const m = stores[store];
  if (!m) return undefined;
  const e = m.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    m.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet<T>(store: string, key: string, value: T, ttlMs: number): void {
  if (!stores[store]) stores[store] = new Map();
  stores[store].set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function cacheWrap<T>(
  store: string,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(store, key);
  if (hit !== undefined) return hit;
  const value = await load();
  cacheSet(store, key, value, ttlMs);
  return value;
}

// Diagnostic — returns counts per store. Useful for /health.
export function cacheStats(): Record<string, { size: number; sample?: string[] }> {
  const out: Record<string, { size: number; sample?: string[] }> = {};
  for (const [name, m] of Object.entries(stores)) {
    out[name] = { size: m.size };
    if (m.size > 0) {
      out[name].sample = Array.from(m.keys()).slice(0, 5);
    }
  }
  return out;
}

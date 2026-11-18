/**
 * Cache em memória com TTL, deduplicação de requisições simultâneas e
 * espera após falha (não martela um provedor fora do ar ou com limite estourado).
 * Em falha, serve o último valor válido quando houver.
 */
interface Entry { at?: number; value?: unknown; pending?: Promise<unknown>; failedAt?: number; error?: unknown }
const store = new Map<string, Entry>();
const FAIL_BACKOFF_MS = 30_000;
export async function cached<T>(key: string, ttlMs: number, fn: () => T | Promise<T>): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit?.pending) return hit.pending as Promise<T>;
  if (hit && 'value' in hit && now - (hit.at ?? 0) < ttlMs) return hit.value as T;
  if (hit?.failedAt && now - hit.failedAt < FAIL_BACKOFF_MS) {
    if ('value' in hit) return hit.value as T;
    throw hit.error;
  }
  const pending = Promise.resolve().then(fn).then(
    (value) => { store.set(key, { at: Date.now(), value }); return value; },
    (error) => {
      const { pending: _p, ...prev } = hit ?? {};
      store.set(key, { ...prev, failedAt: Date.now(), error });
      if (hit && 'value' in hit) return hit.value as T;
      throw error;
    },
  );
  store.set(key, { ...(hit ?? {}), pending });
  return pending;
}

export async function getJSON<T = any>(url: string, { timeout = 8000, headers = {} as Record<string, string> } = {}): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'MarketBrasil/0.1', Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${url.replace(/token=[^&]+/, 'token=***')}`);
  return res.json() as Promise<T>;
}

export async function getText(url: string, timeout = 8000): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBrasil/0.1)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

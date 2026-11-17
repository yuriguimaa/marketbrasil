/**
 * Cache em memória com TTL, deduplicação de requisições simultâneas e
 * espera após falha (não martela um provedor fora do ar ou com limite estourado).
 * Em falha, serve o último valor válido quando houver.
 */
const store = new Map();
const FAIL_BACKOFF_MS = 30_000;
export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit?.pending) return hit.pending;
  if (hit && 'value' in hit && now - hit.at < ttlMs) return hit.value;
  if (hit?.failedAt && now - hit.failedAt < FAIL_BACKOFF_MS) {
    if ('value' in hit) return hit.value;
    throw hit.error;
  }
  const pending = Promise.resolve().then(fn).then(
    (value) => { store.set(key, { at: Date.now(), value }); return value; },
    (error) => {
      const { pending: _p, ...prev } = hit ?? {};
      store.set(key, { ...prev, failedAt: Date.now(), error });
      if (hit && 'value' in hit) return hit.value;
      throw error;
    },
  );
  store.set(key, { ...(hit ?? {}), pending });
  return pending;
}

export async function getJSON(url, { timeout = 8000, headers = {} } = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'MarketBrasil/0.1', Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${url.replace(/token=[^&]+/, 'token=***')}`);
  return res.json();
}

export async function getText(url, timeout = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBrasil/0.1)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

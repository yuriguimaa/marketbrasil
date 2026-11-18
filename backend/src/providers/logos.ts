import { B3_SYMBOLS, COINGECKO_IDS, US_SYMBOLS } from '../symbols.js';

// Logos das empresas/ativos. O backend busca, guarda em memória e serve ao frontend,
// para que o navegador não dependa diretamente de servidores de terceiros.
export interface Logo { type: string; body: Buffer }

const sources = (s: string): string[] => {
  if (B3_SYMBOLS.has(s)) return [`https://icons.brapi.dev/icons/${s}.svg`];
  if (US_SYMBOLS.has(s)) return [`https://financialmodelingprep.com/image-stock/${s}.png`];
  if (s in COINGECKO_IDS) return [`https://assets.coincap.io/assets/icons/${s.toLowerCase()}@2x.png`];
  return [];
};

const cache = new Map<string, Logo | null>();
const MAX_BYTES = 300_000;

export async function getLogo(symbol: string): Promise<Logo | null> {
  if (cache.has(symbol)) return cache.get(symbol) ?? null;
  let hit: Logo | null = null;
  for (const url of sources(symbol)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBrasil/0.1)' } });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !/^image\/(svg\+xml|png|jpeg|webp)/.test(type)) continue;
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > MAX_BYTES) continue;
      hit = { type, body };
      break;
    } catch { /* tenta a próxima fonte */ }
  }
  cache.set(symbol, hit);
  return hit;
}

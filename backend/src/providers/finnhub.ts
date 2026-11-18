import { cached, getJSON } from '../cache.js';
import { config } from '../config.js';
import { US_SYMBOLS } from '../symbols.js';
import type { Provider, Quotes } from '../types.js';

interface FhQuote { c: number; pc: number; d?: number; dp?: number; o: number; h: number; l: number; t: number }

// Finnhub — cotações de ações/ETFs dos EUA (requer chave gratuita)
const BASE = 'https://finnhub.io/api/v1';

export const finnhub: Provider = {
  id: 'finnhub', name: 'Finnhub', scope: 'EUA: ações, ETFs e REITs',
  enabled: () => !!config.finnhubToken,
  get note() {
    return config.finnhubToken ? 'Chave configurada.' : 'Defina FINNHUB_TOKEN no .env (chave gratuita em finnhub.io).';
  },
  supports: (s: string) => !!config.finnhubToken && US_SYMBOLS.has(s),

  async quotes(symbols: string[]): Promise<Quotes> {
    if (!config.finnhubToken) return {};
    const list = symbols.filter((s) => US_SYMBOLS.has(s));
    const out: Quotes = {};
    for (let i = 0; i < list.length; i += 5) {
      const chunk = list.slice(i, i + 5);
      const res = await Promise.allSettled(chunk.map((s) =>
        cached(`fh:${s}`, 60_000, () => getJSON<FhQuote>(`${BASE}/quote?symbol=${s}&token=${config.finnhubToken}`))));
      res.forEach((r, j) => {
        if (r.status === 'rejected') { console.warn('[finnhub]', chunk[j], (r.reason as Error)?.message); return; }
        const d = r.value;
        if (!d || !d.c) return;
        out[chunk[j]] = {
          symbol: chunk[j], price: d.c, prevClose: d.pc, change: d.d ?? 0, changePct: d.dp ?? 0,
          open: d.o, high: d.h, low: d.l, volume: 0, volumeFin: 0,
          updatedAt: d.t * 1000, source: 'live', provider: 'Finnhub',
        };
      });
    }
    return out;
  },
};

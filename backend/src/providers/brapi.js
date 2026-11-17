import { cached, getJSON } from '../cache.js';
import { config } from '../config.js';
import { B3_INDEX, B3_SYMBOLS, BRAPI_FREE } from '../symbols.js';

// brapi.dev — cotações da B3 (atraso típico de ~15 min no plano gratuito)
const BASE = 'https://brapi.dev/api/quote/';
const toBrapi = (s) => B3_INDEX[s] ?? s;
const allowed = (s) => (B3_SYMBOLS.has(s) || s in B3_INDEX) && (!!config.brapiToken || BRAPI_FREE.has(s));

async function one(sym, extra = '') {
  const q = [config.brapiToken ? `token=${config.brapiToken}` : '', extra].filter(Boolean).join('&');
  const data = await cached(`brapi:${sym}:${extra}`, extra ? 15 * 60_000 : 60_000, () =>
    getJSON(`${BASE}${encodeURIComponent(toBrapi(sym))}${q ? '?' + q : ''}`));
  return data?.results?.[0];
}

export const brapi = {
  id: 'brapi', name: 'brapi.dev', scope: 'B3: ações, FIIs, ETFs, BDRs, Ibovespa',
  enabled: () => true,
  get note() {
    return config.brapiToken
      ? 'Token configurado. Cotações com atraso de ~15 min.'
      : 'Sem token: apenas PETR4, VALE3, MGLU3 e ITUB4. Defina BRAPI_TOKEN no .env para os demais.';
  },
  supports: allowed,

  async quotes(symbols) {
    const list = symbols.filter(allowed);
    const out = {};
    for (let i = 0; i < list.length; i += 4) {
      const chunk = list.slice(i, i + 4);
      const res = await Promise.allSettled(chunk.map((s) => one(s)));
      res.forEach((r, j) => {
        const d = r.status === 'fulfilled' ? r.value : null;
        if (!d || d.regularMarketPrice == null) return;
        const p = d.regularMarketPrice;
        out[chunk[j]] = {
          symbol: chunk[j], price: p,
          prevClose: d.regularMarketPreviousClose ?? p - (d.regularMarketChange ?? 0),
          change: d.regularMarketChange ?? 0, changePct: d.regularMarketChangePercent ?? 0,
          open: d.regularMarketOpen ?? p, high: d.regularMarketDayHigh ?? p, low: d.regularMarketDayLow ?? p,
          volume: d.regularMarketVolume ?? 0, volumeFin: (d.regularMarketVolume ?? 0) * p,
          marketCap: d.marketCap ?? undefined,
          updatedAt: Date.parse(d.regularMarketTime) || Date.now(), source: 'delayed', delayMin: 15, provider: 'brapi.dev',
        };
      });
    }
    return out;
  },

  async history(symbol, period) {
    if (!allowed(symbol)) return null;
    // plano gratuito da brapi: só intervalo diário e ranges até 3 meses (o resto vem do Yahoo)
    const range = { '1M': '1mo', '3M': '3mo' }[period];
    if (!range) return null;
    const interval = '1d';
    const d = await one(symbol, `range=${range}&interval=${interval}`);
    const rows = d?.historicalDataPrice;
    if (!rows?.length) return null;
    const bars = rows.filter((r) => r.close != null)
      .map((r) => { const o = r.open ?? r.close; return { time: r.date, open: o, high: Math.max(r.high ?? o, o, r.close), low: Math.min(r.low ?? o, o, r.close), close: r.close, volume: r.volume ?? 0 }; })
      .sort((a, b) => a.time - b.time);
    return { bars, intraday: period === '1D' || period === '1S', source: 'delayed' };
  },

  async fundamentals(symbol) {
    if (!allowed(symbol) || symbol in B3_INDEX) return null;
    const d = await one(symbol, 'fundamental=true');
    if (!d || d.priceEarnings == null) return null;
    return { pl: d.priceEarnings, source: 'delayed' };
  },
};

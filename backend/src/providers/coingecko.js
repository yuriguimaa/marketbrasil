import { cached, getJSON } from '../cache.js';
import { COINGECKO_IDS } from '../symbols.js';

// CoinGecko — API pública de criptomoedas (sem chave)
const BASE = 'https://api.coingecko.com/api/v3';
const bySymbol = Object.fromEntries(Object.entries(COINGECKO_IDS).map(([s, id]) => [id, s]));

export const coingecko = {
  id: 'coingecko', name: 'CoinGecko', scope: 'Criptomoedas (preço, volume, market cap, histórico)',
  enabled: () => true,
  note: 'API pública, sem chave. Dados em tempo real (~1 min).',
  supports: (s) => s in COINGECKO_IDS,

  async quotes(symbols) {
    if (!symbols.some((s) => s in COINGECKO_IDS)) return {};
    const rows = await cached('cg:markets', 60_000, () =>
      getJSON(`${BASE}/coins/markets?vs_currency=usd&ids=${Object.values(COINGECKO_IDS).join(',')}&sparkline=true&price_change_percentage=24h`));
    const out = {};
    for (const r of rows) {
      const sym = bySymbol[r.id];
      if (!sym || !symbols.includes(sym) || !r.current_price) continue;
      const prev = r.current_price - (r.price_change_24h ?? 0);
      const spark = r.sparkline_in_7d?.price;
      out[sym] = {
        symbol: sym, price: r.current_price, prevClose: prev, change: r.price_change_24h ?? 0,
        changePct: r.price_change_percentage_24h ?? 0, open: prev, high: r.high_24h, low: r.low_24h,
        volume: r.total_volume / r.current_price, volumeFin: r.total_volume, marketCap: r.market_cap,
        updatedAt: Date.parse(r.last_updated) || Date.now(), source: 'live', provider: 'CoinGecko',
        spark: spark ? spark.slice(-24) : undefined,
      };
    }
    return out;
  },

  async history(symbol, period) {
    const id = COINGECKO_IDS[symbol];
    if (!id) return null;
    // o endpoint OHLC aceita days = 1, 7, 14, 30, 90, 180, 365
    const days = { '1D': 1, '1S': 7, '1M': 30, '3M': 90, '6M': 180, '1A': 365, '5A': 365, MAX: 365 }[period];
    const rows = await cached(`cg:ohlc:${id}:${days}`, period === '1D' ? 120_000 : 15 * 60_000, () =>
      getJSON(`${BASE}/coins/${id}/ohlc?vs_currency=usd&days=${days}`, { timeout: 12000 }));
    const bars = rows.map(([t, o, h, l, c]) => ({ time: Math.floor(t / 1000), open: o, high: h, low: l, close: c, volume: 0 }));
    return { bars, intraday: period === '1D' || period === '1S', source: 'live' };
  },
};

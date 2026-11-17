import { cached, getJSON } from '../cache.js';

// AwesomeAPI — cotações de câmbio (sem chave)
export const fx = {
  id: 'awesomeapi', name: 'AwesomeAPI', scope: 'Dólar comercial (USD/BRL)',
  enabled: () => true,
  note: 'API pública, sem chave. Atualização a cada ~30 s.',
  supports: (s) => s === 'USDBRL',

  async quotes(symbols) {
    if (!symbols.includes('USDBRL')) return {};
    const r = (await cached('fx:last', 30_000, () => getJSON('https://economia.awesomeapi.com.br/json/last/USD-BRL'))).USDBRL;
    const price = parseFloat(r.bid), change = parseFloat(r.varBid);
    return {
      USDBRL: {
        symbol: 'USDBRL', price, prevClose: price - change, change, changePct: parseFloat(r.pctChange),
        open: price - change, high: parseFloat(r.high), low: parseFloat(r.low), volume: 0, volumeFin: 0,
        updatedAt: Number(r.timestamp) * 1000, source: 'live', provider: 'AwesomeAPI',
      },
    };
  },

  async history(symbol, period) {
    if (symbol !== 'USDBRL' || period === '1D' || period === '1S') return null;
    const n = { '1M': 30, '3M': 90, '6M': 180, '1A': 365, '5A': 360, MAX: 360 }[period];
    const rows = await cached(`fx:daily:${n}`, 30 * 60_000, () => getJSON(`https://economia.awesomeapi.com.br/json/daily/USD-BRL/${n}`));
    const bars = rows.map((r) => {
      const c = parseFloat(r.bid), ch = parseFloat(r.varBid || '0');
      return { time: Math.floor(Number(r.timestamp) / 86400) * 86400, open: c - ch, high: parseFloat(r.high), low: parseFloat(r.low), close: c, volume: 0 };
    }).reverse();
    const seen = new Set();
    return { bars: bars.filter((b) => !seen.has(b.time) && seen.add(b.time)), intraday: false, source: 'live' };
  },
};

import { cached, getJSON } from '../cache.js';
import type { History, Period, Provider, Quotes } from '../types.js';

interface FxRow { bid: string; varBid?: string; pctChange: string; high: string; low: string; timestamp: string }

// AwesomeAPI — cotações de câmbio (sem chave)
export const fx: Provider = {
  id: 'awesomeapi', name: 'AwesomeAPI', scope: 'Dólar comercial (USD/BRL)',
  enabled: () => true,
  note: 'API pública, sem chave. Atualização a cada ~30 s.',
  supports: (s: string) => s === 'USDBRL',

  async quotes(symbols: string[]): Promise<Quotes> {
    if (!symbols.includes('USDBRL')) return {};
    const r = (await cached<{ USDBRL: FxRow }>('fx:last', 30_000, () => getJSON('https://economia.awesomeapi.com.br/json/last/USD-BRL'))).USDBRL;
    const price = parseFloat(r.bid), change = parseFloat(r.varBid ?? '0');
    return {
      USDBRL: {
        symbol: 'USDBRL', price, prevClose: price - change, change, changePct: parseFloat(r.pctChange),
        open: price - change, high: parseFloat(r.high), low: parseFloat(r.low), volume: 0, volumeFin: 0,
        updatedAt: Number(r.timestamp) * 1000, source: 'live', provider: 'AwesomeAPI',
      },
    };
  },

  async history(symbol: string, period: Period): Promise<History | null> {
    if (symbol !== 'USDBRL' || period === '1D' || period === '1S') return null;
    const n = ({ '1M': 30, '3M': 90, '6M': 180, '1A': 365, '5A': 360, MAX: 360 } as Record<string, number>)[period];
    const rows = await cached<FxRow[]>(`fx:daily:${n}`, 30 * 60_000, () => getJSON(`https://economia.awesomeapi.com.br/json/daily/USD-BRL/${n}`));
    const bars = rows.map((r) => {
      const c = parseFloat(r.bid), ch = parseFloat(r.varBid || '0');
      return { time: Math.floor(Number(r.timestamp) / 86400) * 86400, open: c - ch, high: parseFloat(r.high), low: parseFloat(r.low), close: c, volume: 0 };
    }).reverse();
    const seen = new Set<number>();
    return { bars: bars.filter((b) => !seen.has(b.time) && seen.add(b.time)), intraday: false, source: 'live' };
  },
};

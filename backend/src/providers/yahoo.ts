import { cached, getJSON } from '../cache.js';
import { B3_SYMBOLS, US_SYMBOLS } from '../symbols.js';
import type { Bar, History, Period, Provider, Quotes } from '../types.js';

interface ChartResult {
  meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number; regularMarketVolume?: number; regularMarketTime?: number };
  timestamp?: number[];
  indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
}

/**
 * Yahoo Finance (API NÃO oficial, sem chave): índices (BR e EUA) e ativos da B3
 * (ações, FIIs, ETFs e BDRs). Com BRAPI_TOKEN configurado, a brapi (oficial)
 * tem prioridade nas cotações da B3. Pode mudar ou bloquear sem aviso;
 * desative com YAHOO_ENABLED=0 no .env.
 */
const MAP: Record<string, string> = {
  IBOV: '^BVSP', IFIX: 'IFIX.SA', SMLL: 'SMLL.SA', IDIV: 'IDIV.SA',
  SPX: '^GSPC', NDX: '^NDX', DJI: '^DJI', RUT: '^RUT', VIX: '^VIX',
  ...Object.fromEntries([...B3_SYMBOLS].map((s) => [s, s + '.SA'])),
  // reserva quando Finnhub/AwesomeAPI não respondem (ex.: bloqueio de IPs de nuvem)
  ...Object.fromEntries([...US_SYMBOLS].map((s) => [s, s])),
  USDBRL: 'BRL=X',
  // tickers renomeados na B3 (a brapi ainda aceita o código antigo)
  ...Object.fromEntries(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT'].map((s) => [s, s + '-USD'])),
  EMBR3: 'EMBJ3.SA', ELET3: 'AXIA3.SA', JBSS3: 'JBSS32.SA',
};
/** Índices em que o Yahoo só tem dados intradiários: as velas diárias/semanais são montadas a partir das horárias. */
const HOURLY_ONLY = new Set(['IFIX', 'SMLL', 'IDIV']);
const BRT = -3 * 3600;
/** Agrupa velas em dias (fuso de Brasília) ou semanas. */
function aggregate(bars: Bar[], unit: 'day' | 'week'): Bar[] {
  const out: (Bar & { key: number })[] = [];
  for (const b of bars) {
    const d = Math.floor((b.time + BRT) / 86400);
    const key = unit === 'week' ? d - ((d + 3) % 7) : d; // semana começando na segunda-feira
    const last = out[out.length - 1];
    if (last && last.key === key) {
      last.high = Math.max(last.high, b.high); last.low = Math.min(last.low, b.low); last.close = b.close; last.volume += b.volume;
    } else out.push({ key, time: key * 86400 - BRT, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
  }
  return out.map(({ key, ...b }) => b);
}
const CRYPTO = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT']);
const BR = new Set(['IBOV', 'IFIX', 'SMLL', 'IDIV', ...B3_SYMBOLS]);
const INDEX = new Set(['IBOV', 'IFIX', 'SMLL', 'IDIV', 'SPX', 'NDX', 'DJI', 'RUT', 'VIX']);

/** Executa no máximo `n` tarefas ao mesmo tempo. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out = new Array<PromiseSettledResult<R>>(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = { status: 'fulfilled', value: await fn(items[k]) }; } catch (e) { out[k] = { status: 'rejected', reason: e }; } }
  }));
  return out;
}
const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const enabled = () => process.env.YAHOO_ENABLED !== '0';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBrasil/0.1)' };

const chart = (sym: string, range: string, interval: string, ttl: number): Promise<ChartResult> =>
  cached<{ chart?: { result?: ChartResult[]; error?: { description?: string } } }>(`yh:${sym}:${range}:${interval}`, ttl, () =>
    getJSON(`${BASE}${encodeURIComponent(MAP[sym])}?range=${range}&interval=${interval}&includePrePost=false`, { headers: HEADERS }))
    .then((j) => {
      const r = j?.chart?.result?.[0];
      if (!r) throw new Error(j?.chart?.error?.description ?? 'resposta vazia');
      return r;
    });

export const yahoo: Provider = {
  id: 'yahoo', name: 'Yahoo Finance (não oficial)', scope: 'Índices (Ibovespa, IFIX, S&P 500, Nasdaq…) e B3: ações, FIIs, ETFs e BDRs',
  enabled,
  note: 'Sem chave. API não oficial: pode mudar sem aviso. Desative com YAHOO_ENABLED=0.',
  supports: (s: string) => enabled() && s in MAP,

  async quotes(symbols: string[]): Promise<Quotes> {
    if (!enabled()) return {};
    const list = symbols.filter((s) => s in MAP);
    const res = await pool(list, 6, (s) => chart(s, '1d', '5m', 60_000));
    const out: Quotes = {};
    res.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const sym = list[i];
      const m = r.value.meta ?? {};
      const price = m.regularMarketPrice;
      const prev = m.chartPreviousClose ?? m.previousClose;
      if (price == null || prev == null || !isFinite(price) || !isFinite(prev)) return;
      const closes = (r.value.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => v != null);
      const opens = (r.value.indicators?.quote?.[0]?.open ?? []).filter((v): v is number => v != null);
      out[sym] = {
        symbol: sym, price, prevClose: prev, change: price - prev, changePct: ((price - prev) / prev) * 100,
        open: opens[0] ?? prev, high: m.regularMarketDayHigh ?? Math.max(price, ...closes), low: m.regularMarketDayLow ?? Math.min(price, ...closes),
        volume: m.regularMarketVolume ?? 0, volumeFin: INDEX.has(sym) ? 0 : CRYPTO.has(sym) ? (m.regularMarketVolume ?? 0) : (m.regularMarketVolume ?? 0) * price,
        updatedAt: (m.regularMarketTime ?? Date.now() / 1000) * 1000,
        source: BR.has(sym) ? 'delayed' : 'live', delayMin: BR.has(sym) ? 15 : undefined, provider: 'Yahoo Finance',
        ...(sym === 'USDBRL' ? { volume: 0, volumeFin: 0 } : {}),
        spark: closes.length > 1 ? [prev, ...closes] : undefined,
      };
    });
    return out;
  },

  async history(symbol: string, period: Period): Promise<History | null> {
    if (!(symbol in MAP) || !enabled()) return null;
    const intraday = period === '1D' || period === '1S';
    const hourly = HOURLY_ONLY.has(symbol) && !intraday;
    const [range, interval] = hourly
      ? ({ '1M': ['1mo', '1h'], '3M': ['3mo', '1h'], '6M': ['6mo', '1h'], '1A': ['1y', '1h'], '5A': ['2y', '1h'], MAX: ['2y', '1h'] } as Partial<Record<Period, [string, string]>>)[period] ?? ['1mo', '1h']
      : ({
        '1D': ['1d', '5m'], '1S': ['5d', '30m'], '1M': ['1mo', '1d'], '3M': ['3mo', '1d'],
        '6M': ['6mo', '1d'], '1A': ['1y', '1d'], '5A': ['5y', '1wk'], MAX: ['max', '1mo'],
      } as Record<Period, [string, string]>)[period];
    const r = await chart(symbol, range, interval, period === '1D' ? 60_000 : 15 * 60_000);
    const t = r.timestamp ?? [];
    const q = r.indicators?.quote?.[0] ?? {};
    let bars: Bar[] = [];
    for (let i = 0; i < t.length; i++) {
      const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
      if (o == null || h == null || l == null || c == null || ![o, h, l, c].every(Number.isFinite)) continue;
      bars.push({ time: t[i], open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c, volume: q.volume?.[i] ?? 0 });
    }
    if (hourly) bars = aggregate(bars, period === '5A' || period === 'MAX' ? 'week' : 'day');
    return { bars, intraday, source: BR.has(symbol) ? 'delayed' : 'live' };
  },
};

export const YAHOO_SYMBOLS = Object.keys(MAP);

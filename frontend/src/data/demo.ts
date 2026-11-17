/**
 * Gerador determinístico de DADOS DE DEMONSTRAÇÃO.
 * Nada aqui representa cotações reais: os valores são produzidos por
 * passeio aleatório com semente fixa por ativo, apenas para exercitar a interface
 * enquanto as APIs não estão conectadas.
 */
import type { Asset, Bar, Fundamentals, History, Period, Quote } from '../types';
import { marketSession } from '../lib/marketHours';

// ---------- PRNG ----------
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const mulberry = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = (r: () => number) => {
  const u = Math.max(r(), 1e-9), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const rngFor = (key: string) => mulberry(hash(key));

const DAY = 86400;
const is24h = (a: Asset) => a.cls === 'crypto';
const dayKey = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

// ---------- Sessões ----------
/** Retorna [início, fim] (unix s) da sessão do ativo para o dia UTC de `t`. */
function sessionBounds(a: Asset, dayStartUtc: number): [number, number] {
  const s = marketSession(a.market === 'US' ? 'US' : 'BR', a.cls);
  return [dayStartUtc + s.openUtcMin * 60, dayStartUtc + s.closeUtcMin * 60];
}
const isWeekday = (t: number) => { const d = new Date(t * 1000).getUTCDay(); return d !== 0 && d !== 6; };

/** Dia (00:00 UTC) da sessão mais recente já iniciada. */
function currentSessionDay(a: Asset, now: number): number {
  let d = Math.floor(now / DAY) * DAY;
  if (is24h(a)) return d;
  for (let i = 0; i < 10; i++) {
    const [open] = sessionBounds(a, d);
    if (isWeekday(d) && open <= now) return d;
    d -= DAY;
  }
  return d;
}

// ---------- Séries diárias ----------
interface Series { daily: Bar[]; today: Bar[]; sessionDay: number }
const cache = new Map<string, Series>();

function genRateDaily(a: Asset, endDay: number, n: number): Bar[] {
  const r = rngFor(a.symbol + ':rate');
  const out: Bar[] = [];
  let level = a.base;
  const levels: number[] = [];
  for (let i = 0; i < n; i++) {
    if (r() < 1 / 40) level = Math.max(2, level + (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? 0.25 : 0.5));
    levels.push(level);
  }
  const shift = a.base - levels[levels.length - 1];
  let t = endDay;
  const times: number[] = [];
  while (times.length < n) { if (isWeekday(t)) times.push(t); t -= DAY; }
  times.reverse();
  for (let i = 0; i < n; i++) {
    const v = +(levels[i] + shift).toFixed(2);
    out.push({ time: times[i], open: v, high: v, low: v, close: v, volume: 0 });
  }
  return out;
}

function genDaily(a: Asset, endDay: number, endClose: number | null): Bar[] {
  const n = is24h(a) ? 3650 : 2600;
  if (a.cls === 'rate') return genRateDaily(a, endDay, n);
  const r = rngFor(a.symbol + ':daily');
  const sd = a.vol / Math.sqrt(is24h(a) ? 365 : 252);
  const drift = (r() - 0.35) * sd * 0.12;
  const times: number[] = [];
  let t = endDay;
  while (times.length < n) { if (is24h(a) || isWeekday(t)) times.push(t); t -= DAY; }
  times.reverse();
  const closes: number[] = [];
  let lp = 0, regime = 1;
  for (let i = 0; i < n; i++) {
    if (r() < 0.01) regime = 0.6 + r() * 1.2;
    lp += drift + gauss(r) * sd * regime;
    closes.push(lp);
  }
  const target = Math.log(endClose ?? a.base * (0.9 + r() * 0.2));
  const off = target - closes[n - 1];
  const out: Bar[] = [];
  let prev = Math.exp(closes[0] + off);
  const avgVol = a.avgVol ?? 1e6;
  for (let i = 0; i < n; i++) {
    const close = Math.exp(closes[i] + off);
    const open = prev * (1 + gauss(r) * sd * 0.25);
    const hi = Math.max(open, close) * (1 + Math.abs(gauss(r)) * sd * 0.45);
    const lo = Math.min(open, close) * (1 - Math.abs(gauss(r)) * sd * 0.45);
    const volume = a.cls === 'index' ? 0 : Math.round(avgVol * Math.exp(gauss(r) * 0.35) * (1 + Math.abs(close / prev - 1) * 8));
    out.push({ time: times[i], open, high: hi, low: lo, close, volume });
    prev = close;
  }
  return out;
}

/** Ponte browniana de `from` até `to` em `n` passos. */
function bridge(from: number, to: number, n: number, sd: number, r: () => number): number[] {
  const w: number[] = [0];
  for (let i = 1; i <= n; i++) w.push(w[i - 1] + gauss(r));
  const pts: number[] = [];
  const lf = Math.log(from), lt = Math.log(to);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const b = w[i] - f * w[n];
    pts.push(Math.exp(lf + (lt - lf) * f + b * sd));
  }
  return pts;
}

function genIntraday(a: Asset, day: number, prevClose: number, now: number, stepMin: number, closeHint?: number, rolling = false): Bar[] {
  const r = rngFor(a.symbol + ':intra:' + dayKey(day) + ':' + stepMin);
  let [open, close] = !is24h(a) ? sessionBounds(a, day) : rolling ? [now - DAY, now] : [day, day + DAY];
  if (rolling) { open = Math.floor(open / (stepMin * 60)) * stepMin * 60; }
  const end = Math.min(close, now);
  const steps = Math.max(1, Math.floor((end - open) / (stepMin * 60)));
  const totalSteps = Math.max(1, Math.floor((close - open) / (stepMin * 60)));
  const sdDay = a.vol / Math.sqrt(is24h(a) ? 365 : 252);
  const dayRet = closeHint ? closeHint / prevClose : Math.exp(gauss(r) * sdDay);
  const target = prevClose * dayRet;
  const gapOpen = prevClose * (1 + gauss(r) * sdDay * 0.2);
  const full = a.cls === 'rate'
    ? Array(totalSteps + 1).fill(prevClose)
    : bridge(gapOpen, target, totalSteps, sdDay * 0.35, r);
  const avgVol = a.avgVol ?? 1e6;
  const bars: Bar[] = [];
  for (let i = 0; i < steps; i++) {
    const o = full[i], c = full[i + 1];
    const wig = sdDay / Math.sqrt(totalSteps) * 0.6;
    const u = 1 - i / totalSteps;
    const shape = 0.6 + 1.6 * (u * u + (1 - u) * (1 - u)); // volume em "U"
    bars.push({
      time: open + i * stepMin * 60,
      open: o, close: c,
      high: Math.max(o, c) * (1 + Math.abs(gauss(r)) * wig),
      low: Math.min(o, c) * (1 - Math.abs(gauss(r)) * wig),
      volume: a.cls === 'index' || a.cls === 'rate' ? 0 : Math.round((avgVol / totalSteps) * shape * Math.exp(gauss(r) * 0.4)),
    });
  }
  return bars;
}

const aggregate = (bars: Bar[], time?: number): Bar => ({
  time: time ?? bars[0].time,
  open: bars[0].open,
  close: bars[bars.length - 1].close,
  high: Math.max(...bars.map((b) => b.high)),
  low: Math.min(...bars.map((b) => b.low)),
  volume: bars.reduce((s, b) => s + b.volume, 0),
});

function series(a: Asset): Series {
  const now = Math.floor(Date.now() / 1000);
  const sDay = currentSessionDay(a, now);
  const key = a.symbol + ':' + sDay;
  const hit = cache.get(key);
  if (hit) return hit;
  // histórico até a sessão anterior
  let prevDay = sDay - DAY;
  while (!is24h(a) && !isWeekday(prevDay)) prevDay -= DAY;
  const past = genDaily(a, prevDay, null);
  const prevClose = past[past.length - 1].close;
  const today = genIntraday(a, sDay, prevClose, now, 5, undefined, is24h(a));
  const s: Series = { daily: [...past, aggregate(today, sDay)], today, sessionDay: sDay };
  cache.set(key, s);
  return s;
}

// ---------- Ticks "ao vivo" de demonstração ----------
const live = new Map<string, { price: number; high: number; low: number; vol: number }>();

export function demoTick(assets: Asset[]) {
  for (const a of assets) {
    if (a.cls === 'rate') continue;
    if (!is24h(a) && !marketSession(a.market === 'US' ? 'US' : 'BR', a.cls).isOpen) continue;
    const s = series(a);
    const last = s.today[s.today.length - 1];
    const cur = live.get(a.symbol) ?? { price: last.close, high: s.daily[s.daily.length - 1].high, low: s.daily[s.daily.length - 1].low, vol: 0 };
    const sd = a.vol / Math.sqrt(252 * 6.5 * 720);
    cur.price *= Math.exp(gauss(Math.random) * sd * 1.2);
    cur.high = Math.max(cur.high, cur.price);
    cur.low = Math.min(cur.low, cur.price);
    cur.vol += Math.round((a.avgVol ?? 0) / 5000 * Math.random());
    live.set(a.symbol, cur);
  }
}

export function demoQuote(a: Asset): Quote {
  const s = series(a);
  const d = s.daily;
  const bar = d[d.length - 1];
  const prev = d[d.length - 2]?.close ?? bar.open;
  const l = live.get(a.symbol);
  const price = l?.price ?? bar.close;
  const volume = bar.volume + (l?.vol ?? 0);
  const shares = a.mcapB ? (a.mcapB * 1e9) / a.base : undefined;
  return {
    symbol: a.symbol,
    price,
    prevClose: prev,
    change: price - prev,
    changePct: ((price - prev) / prev) * 100,
    open: bar.open,
    high: Math.max(l?.high ?? bar.high, price),
    low: Math.min(l?.low ?? bar.low, price),
    volume,
    volumeFin: volume * price,
    marketCap: shares ? shares * price : undefined,
    updatedAt: Date.now(),
    source: 'demo',
    provider: 'Demonstração',
  };
}

/** Sparkline intradiária (fechamentos). */
export function demoSpark(a: Asset): number[] {
  const s = series(a);
  if (a.cls === 'rate') return s.daily.slice(-60).map((b) => b.close);
  const pts = s.today.map((b) => b.close);
  const l = live.get(a.symbol);
  if (l) pts.push(l.price);
  return pts.length > 1 ? pts : s.daily.slice(-30).map((b) => b.close);
}

export function demoPerf(a: Asset, days: number): number {
  const d = series(a).daily;
  const now = demoQuote(a).price;
  const ref = d[Math.max(0, d.length - 1 - days)].close;
  return ((now - ref) / ref) * 100;
}

const weekly = (bars: Bar[]): Bar[] => {
  const out: Bar[] = [];
  let bucket: Bar[] = [];
  let wk = -1;
  for (const b of bars) {
    const w = Math.floor((b.time / DAY + 3) / 7);
    if (w !== wk && bucket.length) { out.push(aggregate(bucket)); bucket = []; }
    wk = w; bucket.push(b);
  }
  if (bucket.length) out.push(aggregate(bucket));
  return out;
};

export function demoHistory(a: Asset, period: Period): History {
  const s = series(a);
  const now = Math.floor(Date.now() / 1000);
  const daily = s.daily.slice();
  const l = live.get(a.symbol);
  const withLive = (bars: Bar[]) => {
    if (!l || !bars.length) return bars;
    const b = { ...bars[bars.length - 1] };
    b.close = l.price; b.high = Math.max(b.high, l.price); b.low = Math.min(b.low, l.price);
    return [...bars.slice(0, -1), b];
  };
  const cal = is24h(a) ? 365 : 252;
  let bars: Bar[];
  let intraday = false;
  switch (period) {
    case '1D': bars = s.today; intraday = true; break;
    case '1S': {
      intraday = true;
      bars = [];
      const prevDays = daily.slice(-6, -1);
      for (let i = 0; i < prevDays.length; i++) {
        const d = prevDays[i];
        const pc = daily[daily.length - 7 + i]?.close ?? d.open;
        bars.push(...genIntraday(a, d.time, pc, now + 10 * DAY, 30, d.close));
      }
      for (let i = 0; i < s.today.length; i += 6) bars.push(aggregate(s.today.slice(i, i + 6)));
      if (is24h(a)) bars = bars.filter((b) => b.time > now - 7 * DAY);
      break;
    }
    case '1M': bars = daily.slice(-Math.round(cal / 12)); break;
    case '3M': bars = daily.slice(-Math.round(cal / 4)); break;
    case '6M': bars = daily.slice(-Math.round(cal / 2)); break;
    case '1A': bars = daily.slice(-cal); break;
    case '5A': bars = weekly(daily.slice(-cal * 5)); break;
    default: bars = weekly(daily);
  }
  return { symbol: a.symbol, period, intraday, bars: withLive(bars), source: 'demo' };
}

export function demoFundamentals(a: Asset): Fundamentals {
  const r = rngFor(a.symbol + ':fund');
  const rng = (lo: number, hi: number) => +(lo + r() * (hi - lo)).toFixed(2);
  const bank = a.sector === 'Bancos' || a.sector === 'Financeiro';
  switch (a.cls) {
    case 'fii':
      return { pvp: rng(0.78, 1.08), dy: rng(8, 13.5), source: 'demo' };
    case 'etf':
      return { dy: rng(0, 6), taxaAdm: rng(0.03, 0.8), source: 'demo' };
    case 'reit':
      return { pl: rng(14, 38), pvp: rng(1, 3.5), roe: rng(3, 14), dy: rng(3, 7.2), margemLiq: rng(10, 45), divLiqEbitda: rng(4, 7), source: 'demo' };
    case 'stock':
    case 'bdr': {
      const us = a.market === 'US' || a.cls === 'bdr';
      return {
        pl: us ? rng(9, 62) : bank ? rng(4.5, 10) : rng(4, 32),
        pvp: bank ? rng(0.7, 2.2) : rng(0.9, us ? 40 : 7),
        roe: rng(6, us ? 45 : 32),
        roic: bank ? undefined : rng(4, us ? 40 : 26),
        margemLiq: rng(3, us ? 50 : 35),
        dy: us ? rng(0, 3.6) : rng(0.5, 13),
        divLiqEbitda: bank ? undefined : rng(-0.8, 3.4),
        evEbitda: bank ? undefined : rng(3, us ? 35 : 14),
        source: 'demo',
      };
    }
    default:
      return { source: 'demo' };
  }
}

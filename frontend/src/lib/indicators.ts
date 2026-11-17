import type { Bar } from '../types';

export interface Pt { time: number; value: number }

export function sma(bars: Bar[], n: number): Pt[] {
  const out: Pt[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= n) sum -= bars[i - n].close;
    if (i >= n - 1) out.push({ time: bars[i].time, value: sum / n });
  }
  return out;
}

const emaArr = (vals: number[], n: number) => {
  const k = 2 / (n + 1);
  const out: number[] = [];
  let e = vals[0];
  for (let i = 0; i < vals.length; i++) { e = i === 0 ? vals[0] : vals[i] * k + e * (1 - k); out.push(e); }
  return out;
};

export function ema(bars: Bar[], n: number): Pt[] {
  const e = emaArr(bars.map((b) => b.close), n);
  return bars.map((b, i) => ({ time: b.time, value: e[i] })).slice(n - 1);
}

export function rsi(bars: Bar[], n = 14): Pt[] {
  const out: Pt[] = [];
  if (bars.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) {
    const d = bars[i].close - bars[i - 1].close;
    if (d > 0) g += d; else l -= d;
  }
  g /= n; l /= n;
  out.push({ time: bars[n].time, value: l === 0 ? 100 : 100 - 100 / (1 + g / l) });
  for (let i = n + 1; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close;
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out.push({ time: bars[i].time, value: l === 0 ? 100 : 100 - 100 / (1 + g / l) });
  }
  return out;
}

export function macd(bars: Bar[], f = 12, s = 26, sig = 9) {
  const c = bars.map((b) => b.close);
  const ef = emaArr(c, f), es = emaArr(c, s);
  const line = c.map((_, i) => ef[i] - es[i]);
  const signal = emaArr(line, sig);
  const start = Math.min(s - 1, bars.length);
  const res = { macd: [] as Pt[], signal: [] as Pt[], hist: [] as Pt[] };
  for (let i = start; i < bars.length; i++) {
    res.macd.push({ time: bars[i].time, value: line[i] });
    res.signal.push({ time: bars[i].time, value: signal[i] });
    res.hist.push({ time: bars[i].time, value: line[i] - signal[i] });
  }
  return res;
}

export function bollinger(bars: Bar[], n = 20, k = 2) {
  const mid: Pt[] = [], up: Pt[] = [], lo: Pt[] = [];
  for (let i = n - 1; i < bars.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += bars[j].close;
    const m = s / n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (bars[j].close - m) ** 2;
    const sd = Math.sqrt(v / n);
    mid.push({ time: bars[i].time, value: m });
    up.push({ time: bars[i].time, value: m + k * sd });
    lo.push({ time: bars[i].time, value: m - k * sd });
  }
  return { mid, up, lo };
}

/** VWAP. Em barras intradiárias reinicia a cada dia; em diárias acumula no período. */
export function vwap(bars: Bar[], intraday: boolean): Pt[] {
  const out: Pt[] = [];
  let pv = 0, vv = 0, day = -1;
  for (const b of bars) {
    const d = Math.floor(b.time / 86400);
    if (intraday && d !== day) { pv = 0; vv = 0; day = d; }
    const tp = (b.high + b.low + b.close) / 3;
    const v = b.volume || 1;
    pv += tp * v; vv += v;
    out.push({ time: b.time, value: pv / vv });
  }
  return out;
}

/** Suportes e resistências por topos/fundos locais + pivô clássico. */
export function supportResistance(bars: Bar[], win = 5, max = 3) {
  if (bars.length < win * 2 + 1) return { supports: [] as number[], resistances: [] as number[], pivot: undefined as number | undefined };
  const last = bars[bars.length - 1].close;
  const highs: number[] = [], lows: number[] = [];
  for (let i = win; i < bars.length - win; i++) {
    const h = bars[i].high, l = bars[i].low;
    let isH = true, isL = true;
    for (let j = i - win; j <= i + win; j++) {
      if (bars[j].high > h) isH = false;
      if (bars[j].low < l) isL = false;
    }
    if (isH) highs.push(h);
    if (isL) lows.push(l);
  }
  const cluster = (arr: number[]) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      if (out.length && Math.abs(v - out[out.length - 1]) / v < 0.012) out[out.length - 1] = (out[out.length - 1] + v) / 2;
      else out.push(v);
    }
    return out;
  };
  const res = cluster(highs).filter((v) => v > last).slice(0, max);
  const sup = cluster(lows).filter((v) => v < last).reverse().slice(0, max);
  const p = bars[bars.length - 2] ?? bars[bars.length - 1];
  const pivot = (p.high + p.low + p.close) / 3;
  return { supports: sup, resistances: res, pivot };
}

export const lastVal = (pts: Pt[]) => (pts.length ? pts[pts.length - 1].value : undefined);

/** Resumo textual dos sinais técnicos. */
export function technicalSummary(bars: Bar[]) {
  const close = bars[bars.length - 1]?.close;
  const r = lastVal(rsi(bars));
  const m = macd(bars);
  const mh = lastVal(m.hist);
  const s20 = lastVal(sma(bars, 20)), s50 = lastVal(sma(bars, 50)), s200 = lastVal(sma(bars, 200));
  const bb = bollinger(bars);
  const bu = lastVal(bb.up), bl = lastVal(bb.lo);
  const vw = lastVal(vwap(bars, false));
  const signals: { name: string; value: string; signal: 'Compra' | 'Venda' | 'Neutro' }[] = [];
  const sig = (cond: boolean | undefined, inv?: boolean | undefined) => (cond ? 'Compra' : inv ? 'Venda' : 'Neutro') as 'Compra' | 'Venda' | 'Neutro';
  if (r != null) signals.push({ name: 'RSI (14)', value: r.toFixed(1), signal: r < 30 ? 'Compra' : r > 70 ? 'Venda' : 'Neutro' });
  if (mh != null) signals.push({ name: 'MACD (12,26,9)', value: mh.toFixed(3), signal: sig(mh > 0, mh < 0) });
  if (s20 != null && close != null) signals.push({ name: 'MM 20', value: s20.toFixed(2), signal: sig(close > s20, close < s20) });
  if (s50 != null && close != null) signals.push({ name: 'MM 50', value: s50.toFixed(2), signal: sig(close > s50, close < s50) });
  if (s200 != null && close != null) signals.push({ name: 'MM 200', value: s200.toFixed(2), signal: sig(close > s200, close < s200) });
  if (bu != null && bl != null && close != null) signals.push({ name: 'Bollinger (20,2)', value: `${bl.toFixed(2)} – ${bu.toFixed(2)}`, signal: close < bl ? 'Compra' : close > bu ? 'Venda' : 'Neutro' });
  if (vw != null && close != null) signals.push({ name: 'VWAP (período)', value: vw.toFixed(2), signal: sig(close > vw, close < vw) });
  const buy = signals.filter((s) => s.signal === 'Compra').length;
  const sell = signals.filter((s) => s.signal === 'Venda').length;
  const overall = buy - sell >= 2 ? 'Compra' : sell - buy >= 2 ? 'Venda' : 'Neutro';
  return { signals, buy, sell, neutral: signals.length - buy - sell, overall };
}

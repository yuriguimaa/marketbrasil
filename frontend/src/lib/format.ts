import type { Asset, Unit } from '../types';

const nf = (min: number, max = min) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

const cache = new Map<string, Intl.NumberFormat>();
const fmt = (min: number, max = min) => {
  const k = min + ':' + max;
  if (!cache.has(k)) cache.set(k, nf(min, max));
  return cache.get(k)!;
};

export const num = (v: number | undefined | null, d = 2) =>
  v == null || !isFinite(v) ? '—' : fmt(d).format(v);

/** Casas decimais adequadas ao nível de preço. */
export const autoDecimals = (v: number, a?: Asset) => {
  if (a?.decimals != null) return a.decimals;
  const x = Math.abs(v);
  if (x >= 1000) return 2;
  if (x >= 1) return 2;
  if (x >= 0.01) return 4;
  return 6;
};

export const currencySymbol = (u: Unit) => (u === 'BRL' ? 'R$' : u === 'USD' ? 'US$' : '');

export const price = (v: number | undefined, a?: Asset, withSymbol = false) => {
  if (v == null || !isFinite(v)) return '—';
  const d = autoDecimals(v, a);
  const s = fmt(d).format(v);
  if (a?.unit === 'PCT') return s + '%';
  if (withSymbol && a && (a.unit === 'BRL' || a.unit === 'USD')) return currencySymbol(a.unit) + ' ' + s;
  return s;
};

export const money = (v: number | undefined, unit: 'BRL' | 'USD' = 'BRL', d = 2) =>
  v == null || !isFinite(v) ? '—' : currencySymbol(unit) + ' ' + fmt(d).format(v);

export const pct = (v: number | undefined, d = 2, sign = true) =>
  v == null || !isFinite(v) ? '—' : (sign && v > 0 ? '+' : '') + fmt(d).format(v) + '%';

export const signed = (v: number | undefined, d = 2) =>
  v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + fmt(d).format(v);

/** 1,23 tri / 45,6 bi / 789 mi / 12,3 mil */
export const compact = (v: number | undefined, unit?: Unit) => {
  if (v == null || !isFinite(v) || v === 0) return '—';
  const x = Math.abs(v);
  const pre = unit === 'BRL' || unit === 'USD' ? currencySymbol(unit) + ' ' : '';
  const out =
    x >= 1e12 ? fmt(2).format(v / 1e12) + ' tri'
    : x >= 1e9 ? fmt(1).format(v / 1e9) + ' bi'
    : x >= 1e6 ? fmt(1).format(v / 1e6) + ' mi'
    : x >= 1e3 ? fmt(1).format(v / 1e3) + ' mil'
    : fmt(0).format(v);
  return pre + out;
};

export const dirClass = (v: number | undefined) => (v == null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down');

export const timeHM = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const relTime = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const unitLabel = (u: Unit) => (u === 'PTS' ? 'pts' : u === 'PCT' ? '% a.a.' : u);

/**
 * Serviço de dados de mercado do frontend.
 * Combina dados do backend (quando conectado) com o gerador de demonstração,
 * marcando a origem de cada cotação: 'live', 'delayed' ou 'demo'.
 */
import { useSyncExternalStore } from 'react';
import type { Asset, Fundamentals, History, Period, ProviderStatus, Quote } from '../types';
import { ALL_ASSETS, getAsset } from '../data/universe';
import { demoFundamentals, demoHistory, demoPerf, demoQuote, demoSpark, demoTick } from '../data/demo';
import { api } from './api';

export interface MarketState {
  quotes: Record<string, Quote>;
  sparks: Record<string, number[]>;
  lastUpdate: number;
  backend: 'checking' | 'online' | 'offline';
  providers: ProviderStatus[];
  liveCount: number;
}

let state: MarketState = {
  quotes: {}, sparks: {}, lastUpdate: 0, backend: 'checking', providers: [], liveCount: 0,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

const liveSparks: Record<string, number[]> = {};
let timer: ReturnType<typeof setInterval> | undefined;
let statusChecked = 0;

/** Últimas cotações reais recebidas (mantidas entre ciclos). */
const lastLive: Record<string, { q: Quote; spark: number[] }> = {};
let busy = false;

function compose(): { quotes: Record<string, Quote>; sparks: Record<string, number[]> } {
  const quotes: Record<string, Quote> = {};
  const sparks: Record<string, number[]> = {};
  for (const a of ALL_ASSETS) {
    const l = lastLive[a.symbol];
    if (l) { quotes[a.symbol] = l.q; sparks[a.symbol] = l.spark; continue; }
    quotes[a.symbol] = demoQuote(a);
    sparks[a.symbol] = demoSpark(a);
  }
  return { quotes, sparks };
}

async function refresh() {
  demoTick(ALL_ASSETS);
  // 1) publica imediatamente (demo + últimas cotações reais)
  state = { ...state, ...compose(), lastUpdate: Date.now() };
  emit();
  if (busy) return;
  busy = true;
  try { await refreshBackend(); } finally { busy = false; }
}

async function refreshBackend() {
  let backend = state.backend;
  let providers = state.providers;
  if (backend !== 'online' || Date.now() - statusChecked > 60_000) {
    const st = await api.status();
    statusChecked = Date.now();
    backend = st?.ok ? 'online' : 'offline';
    providers = st?.providers ?? [];
    historySet = new Set(st?.history ?? []);
    fundamentalsSet = new Set(st?.fundamentals ?? []);
  }

  if (backend === 'online') {
    const res = await api.quotes(ALL_ASSETS.map((a) => a.symbol));
    if (res?.quotes) {
      for (const [sym, q] of Object.entries(res.quotes)) {
        const a = ALL_ASSETS.find((x) => x.symbol === sym);
        if (!a || !isFinite(q.price)) continue;
        const { spark, ...quote } = q;
        let sp: number[];
        if (spark?.length) sp = spark;
        else {
          const arr = (liveSparks[sym] ??= [q.prevClose]);
          if (arr[arr.length - 1] !== q.price) arr.push(q.price);
          if (arr.length > 300) arr.shift();
          sp = arr.length > 1 ? arr : [q.prevClose, q.price];
        }
        // campos não informados pelo provedor (ex.: market cap) ficam vazios, nunca fictícios
        lastLive[sym] = { q: { marketCap: undefined, ...quote }, spark: sp };
      }
    } else {
      backend = 'offline';
    }
  } else {
    for (const k of Object.keys(lastLive)) delete lastLive[k];
  }

  state = { ...state, ...compose(), lastUpdate: Date.now(), backend, providers, liveCount: Object.keys(lastLive).length };
  emit();
  markReady();
  if (backend === 'online' && Object.keys(lastLive).length) void warmPerf();
}

/** Resolvido após a primeira consulta ao backend (sucesso ou falha). */
let markReady: () => void = () => {};
const backendReady = new Promise<void>((r) => { markReady = r; });

export function startMarketData(intervalSec: number) {
  if (timer) clearInterval(timer);
  void refresh();
  timer = setInterval(refresh, Math.max(2, intervalSec) * 1000);
}

export const refreshNow = () => refresh();

export function useMarket<T>(sel: (s: MarketState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}
export const useMarketState = () => useSyncExternalStore(subscribe, () => state);
export const getQuote = (symbol: string): Quote | undefined => state.quotes[symbol];

/**
 * Variação em N pregões. Calculada sobre o histórico de demonstração;
 * com o backend de histórico conectado, substituir por /history agregado no servidor.
 */
export const perf = (a: Asset, days: number): number | undefined => {
  const q = state.quotes[a.symbol];
  // nunca mistura cotação real com histórico fictício
  if (q && q.source !== 'demo') return perfCache.get(a.symbol + ':' + days);
  return demoPerf(a, days);
};

/** Ativos com histórico/fundamentos reais no backend (informados por /api/status). */
let historySet = new Set<string>();
let fundamentalsSet = new Set<string>();

/** Variações calculadas a partir do histórico real (preenchido por warmPerf). */
const perfCache = new Map<string, number>();
let warmed = false;
async function warmPerf() {
  if (warmed) return;
  warmed = true;
  // só ativos com histórico real, em lotes pequenos para respeitar os limites dos provedores
  const syms = Object.keys(lastLive).filter((s) => historySet.has(s) && getAsset(s)?.cls !== 'rate');
  for (let i = 0; i < syms.length; i += 3) {
    await Promise.all(syms.slice(i, i + 3).map(warmOne));
  }
  state = { ...state };
  emit();
}
async function warmOne(sym: string) {
  {
    try {
      const h = await loadHistory(sym, '1A');
      if (h.source === 'demo' || h.bars.length < 2) return;
      const price = lastLive[sym].q.price;
      const bars = h.bars;
      for (const d of [5, 7, 21, 63, 126, 252, 365]) {
        const ref = bars[Math.max(0, bars.length - 1 - d)].close;
        perfCache.set(sym + ':' + d, (price / ref - 1) * 100);
      }
    } catch { /* ignora */ }
  }
}

const histCache = new Map<string, { at: number; h: History }>();
const histInflight = new Map<string, Promise<History>>();

/** Histórico com cache de 60 s e sem requisições duplicadas simultâneas. */
export function loadHistory(symbol: string, period: Period): Promise<History> {
  const key = symbol + ':' + period;
  const c = histCache.get(key);
  if (c && Date.now() - c.at < 60_000) return Promise.resolve(c.h);
  let p = histInflight.get(key);
  if (!p) {
    p = fetchHistory(symbol, period).finally(() => histInflight.delete(key));
    histInflight.set(key, p);
  }
  return p;
}

async function fetchHistory(symbol: string, period: Period): Promise<History> {
  const a = getAsset(symbol);
  if (!a) throw new Error('Ativo não encontrado: ' + symbol);
  const key = symbol + ':' + period;
  if (state.backend === 'checking') await Promise.race([backendReady, new Promise((r) => setTimeout(r, 8000))]);
  let h: History | null = null;
  if (state.backend === 'online' && historySet.has(symbol)) {
    const r = await api.history(symbol, period);
    if (r?.bars?.length) h = { symbol, period, intraday: r.intraday, bars: r.bars, source: r.source };
  }
  if (!h) {
    h = demoHistory(a, period);
    // ancora o histórico fictício na cotação real, se houver
    const q = state.quotes[symbol];
    const last = h.bars[h.bars.length - 1];
    if (q && q.source !== 'demo' && last) {
      const k = q.price / last.close;
      h = { ...h, bars: h.bars.map((b) => ({ ...b, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k })) };
    }
  }
  histCache.set(key, { at: Date.now(), h });
  return h;
}

export async function loadFundamentals(a: Asset): Promise<Fundamentals> {
  if (state.backend === 'online' && fundamentalsSet.has(a.symbol)) {
    const f = await api.fundamentals(a.symbol);
    if (f && f.source) return f;
  }
  return demoFundamentals(a);
}

/** Fundamentos de demonstração síncronos (para tabelas e rankings). */
export const fundamentalsSync = (a: Asset) => demoFundamentals(a);

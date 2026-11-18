/**
 * Persistência do usuário (watchlists, carteira, preferências).
 * Hoje: localStorage. A interface `Repo` permite trocar por uma implementação
 * remota (ex.: /api/users/me/...) quando autenticação e banco forem ligados.
 */
import { useSyncExternalStore } from 'react';

export interface Repo<T> {
  get(): T;
  set(v: T): void;
  subscribe(l: () => void): () => void;
}

export function localRepo<T>(key: string, initial: T): Repo<T> {
  const k = 'mb:' + key;
  let value: T = initial;
  try {
    const raw = localStorage.getItem(k);
    if (raw) value = JSON.parse(raw) as T;
  } catch { /* storage indisponível */ }
  const ls = new Set<() => void>();
  return {
    get: () => value,
    set(v) {
      value = v;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
      ls.forEach((l) => l());
    },
    subscribe(l) { ls.add(l); return () => ls.delete(l); },
  };
}

export function useRepo<T>(repo: Repo<T>): [T, (v: T | ((p: T) => T)) => void] {
  const v = useSyncExternalStore(repo.subscribe, repo.get);
  const set = (n: T | ((p: T) => T)) => repo.set(typeof n === 'function' ? (n as (p: T) => T)(repo.get()) : n);
  return [v, set];
}

// ---------- Modelos ----------
export interface Watchlist { id: string; name: string; symbols: string[] }

export interface Transaction {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  date: string; // AAAA-MM-DD
  fees?: number;
  /** Origem: digitada no site, importada da planilha da B3 ou trazida do navegador. */
  source?: 'manual' | 'b3' | 'local';
}

export interface Settings {
  refreshSec: number;
  density: 'compact' | 'comfortable';
  showDemoBadges: boolean;
  baseCurrency: 'BRL' | 'USD';
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const watchlistRepo = localRepo<Watchlist[]>('watchlists', [
  { id: 'principal', name: 'Principal', symbols: ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'AAPL', 'NVDA', 'BTC'] },
  { id: 'dividendos', name: 'Dividendos', symbols: ['BBAS3', 'ITUB4', 'HGLG11', 'MXRF11', 'KO', 'O'] },
]);

/** Carteira deste navegador (sem login). Com login a carteira vem da conta: veja portfolio.ts. */
export const localPortfolioRepo = localRepo<Transaction[]>('portfolio', []);

export const settingsRepo = localRepo<Settings>('settings', {
  refreshSec: 5,
  density: 'compact',
  showDemoBadges: true,
  baseCurrency: 'BRL',
});

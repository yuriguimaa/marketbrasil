/**
 * Cliente HTTP do backend. O frontend NUNCA chama provedores externos
 * diretamente: toda integração (B3, EUA, cripto, fundamentos, notícias)
 * fica no serviço de dados em /backend.
 */
import type { Bar, Fundamentals, NewsItem, Period, ProviderStatus, Quote } from '../types';

export type CalCategory = 'inflation' | 'centralBanks' | 'employment' | 'activity' | 'confidence' | 'trade' | 'bonds' | 'holiday' | 'other';
export interface CalEvent {
  id: string; time: number; allDay?: boolean; country: 'BR' | 'US' | 'EU'; title: string;
  importance: 1 | 2 | 3; category: CalCategory; actual?: string; forecast?: string; previous?: string; source: string;
}
export interface EconCalendar { from: number; to: number; events: CalEvent[]; updatedAt: number; partial: string[] }

const BASE: string = (import.meta as any).env?.VITE_API_URL ?? '/api';

async function get<T>(path: string, timeoutMs = 6000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { signal: ctrl.signal, headers: authHeaders() });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Ponto de extensão para autenticação (JWT/sessão). */
let token: string | null = null;
export const setAuthToken = (t: string | null) => { token = t; };
const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

export const api = {
  status: () => get<{ ok: boolean; time: number; providers: ProviderStatus[]; history?: string[]; fundamentals?: string[] }>('/status', 3000),
  quotes: (symbols: string[]) =>
    get<{ quotes: Record<string, Quote & { spark?: number[] }> }>('/quotes?symbols=' + encodeURIComponent(symbols.join(',')), 20000),
  history: (symbol: string, period: Period) =>
    get<{ bars: Bar[]; intraday: boolean; source: Quote['source'] }>(`/history?symbol=${encodeURIComponent(symbol)}&period=${period}`, 10000),
  fundamentals: (symbol: string) => get<Fundamentals>(`/fundamentals?symbol=${encodeURIComponent(symbol)}`),
  calendar: () => get<EconCalendar>('/calendar', 30000),
  news: (q?: string, limit = 40) =>
    get<{ items: NewsItem[]; updatedAt: number }>(`/news?limit=${limit}${q ? '&q=' + encodeURIComponent(q) : ''}`, 9000),
};

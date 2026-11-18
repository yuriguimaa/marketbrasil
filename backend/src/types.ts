/** Tipos compartilhados pelo serviço de dados (mesmo formato que o frontend consome). */

export type Source = 'live' | 'delayed' | 'demo';
export type Period = '1D' | '1S' | '1M' | '3M' | '6M' | '1A' | '5A' | 'MAX';
export const PERIODS: readonly Period[] = ['1D', '1S', '1M', '3M', '6M', '1A', '5A', 'MAX'];

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  volumeFin: number;
  marketCap?: number;
  updatedAt: number;
  source: Source;
  delayMin?: number;
  provider: string;
  spark?: number[];
}
export type Quotes = Record<string, Quote>;

export interface Bar {
  time: number; // segundos (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface History {
  bars: Bar[];
  intraday: boolean;
  source: Source;
}

export interface Fundamentals {
  pl?: number;
  source: Source;
}

/** Contrato de cada fonte de dados (cotações e, opcionalmente, histórico). */
export interface Provider {
  id: string;
  name: string;
  scope: string;
  note: string;
  enabled(): boolean;
  supports(symbol: string): boolean;
  quotes(symbols: string[]): Promise<Quotes>;
  history?(symbol: string, period: Period): Promise<History | null>;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  source: string;
  category: string;
  publishedAt: number;
  tickers: string[];
}

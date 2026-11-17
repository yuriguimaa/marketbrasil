export type Market = 'BR' | 'US' | 'CRYPTO';

export type AssetClass =
  | 'stock'
  | 'fii'
  | 'etf'
  | 'bdr'
  | 'index'
  | 'future'
  | 'reit'
  | 'crypto'
  | 'fx'
  | 'rate';

export type Unit = 'BRL' | 'USD' | 'PTS' | 'PCT';

export interface Asset {
  symbol: string;
  name: string;
  market: Market;
  cls: AssetClass;
  unit: Unit;
  exchange: string;
  sector?: string;
  /** Preço de referência usado apenas pelo gerador de dados de demonstração. */
  base: number;
  /** Volatilidade anual aproximada (demo). */
  vol: number;
  /** Market cap de referência em bilhões (moeda do ativo) — demo. */
  mcapB?: number;
  /** Volume médio diário em unidades — demo. */
  avgVol?: number;
  decimals?: number;
}

/** demo = dados fictícios; live = tempo real; delayed = atrasado (ex.: 15 min). */
export type DataSource = 'demo' | 'live' | 'delayed';

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
  /** Volume financeiro (preço × volume) na moeda do ativo. */
  volumeFin: number;
  marketCap?: number;
  updatedAt: number;
  source: DataSource;
  provider?: string;
  delayMin?: number;
}

export interface Fundamentals {
  pl?: number;
  pvp?: number;
  roe?: number;
  roic?: number;
  margemLiq?: number;
  dy?: number;
  divLiqEbitda?: number;
  evEbitda?: number;
  taxaAdm?: number;
  source: DataSource;
}

export interface Bar {
  time: number; // unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Period = '1D' | '1S' | '1M' | '3M' | '6M' | '1A' | '5A' | 'MAX';

export interface History {
  symbol: string;
  period: Period;
  intraday: boolean;
  bars: Bar[];
  source: DataSource;
}

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source: string;
  category: string;
  publishedAt: number;
  tickers?: string[];
  demo?: boolean;
}

export interface ProviderStatus {
  id: string;
  name: string;
  scope: string;
  enabled: boolean;
  note?: string;
}

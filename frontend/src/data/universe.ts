import type { Asset } from '../types';

/**
 * Catálogo de ativos acompanhados pela plataforma.
 * `base`, `vol`, `mcapB` e `avgVol` são parâmetros do GERADOR DE DEMONSTRAÇÃO
 * e não representam cotações reais. Com o backend conectado a provedores,
 * os valores exibidos passam a vir das APIs.
 */
type Row = [symbol: string, name: string, sector: string, base: number, vol: number, mcapB?: number, avgVol?: number];

const mk = (
  market: Asset['market'],
  cls: Asset['cls'],
  unit: Asset['unit'],
  exchange: string,
  rows: Row[],
  decimals?: number,
): Asset[] =>
  rows.map(([symbol, name, sector, base, vol, mcapB, avgVol]) => ({
    symbol, name, sector, base, vol, mcapB, avgVol, market, cls, unit, exchange, decimals,
  }));

export const BR_STOCKS = mk('BR', 'stock', 'BRL', 'B3', [
  ['PETR4', 'Petrobras PN', 'Petróleo e Gás', 36.4, 0.32, 470, 38e6],
  ['VALE3', 'Vale ON', 'Mineração', 61.2, 0.3, 275, 24e6],
  ['ITUB4', 'Itaú Unibanco PN', 'Bancos', 37.8, 0.22, 365, 22e6],
  ['BBAS3', 'Banco do Brasil ON', 'Bancos', 24.6, 0.27, 140, 26e6],
  ['WEGE3', 'WEG ON', 'Bens Industriais', 44.1, 0.28, 185, 7e6],
  ['BBDC4', 'Bradesco PN', 'Bancos', 15.9, 0.27, 165, 35e6],
  ['PRIO3', 'PRIO ON', 'Petróleo e Gás', 41.3, 0.38, 36, 9e6],
  ['MGLU3', 'Magazine Luiza ON', 'Varejo', 9.4, 0.62, 7, 30e6],
  ['ABEV3', 'Ambev ON', 'Bebidas', 13.2, 0.19, 208, 25e6],
  ['B3SA3', 'B3 ON', 'Serviços Financeiros', 12.7, 0.29, 68, 28e6],
  ['SUZB3', 'Suzano ON', 'Papel e Celulose', 54.8, 0.27, 70, 5e6],
  ['RENT3', 'Localiza ON', 'Locação', 42.5, 0.4, 45, 8e6],
  ['ELET3', 'Eletrobras ON', 'Energia Elétrica', 45.9, 0.3, 102, 10e6],
  ['RADL3', 'Raia Drogasil ON', 'Saúde', 24.3, 0.28, 41, 8e6],
  ['EQTL3', 'Equatorial ON', 'Energia Elétrica', 34.6, 0.24, 43, 7e6],
  ['GGBR4', 'Gerdau PN', 'Siderurgia', 17.4, 0.31, 30, 12e6],
  ['JBSS3', 'JBS ON', 'Alimentos', 38.2, 0.33, 85, 9e6],
  ['EMBR3', 'Embraer ON', 'Bens Industriais', 71.5, 0.42, 52, 4e6],
]);

export const BR_FIIS = mk('BR', 'fii', 'BRL', 'B3', [
  ['HGLG11', 'CSHG Logística', 'Logística', 158.4, 0.12, 5.6, 9e4],
  ['KNRI11', 'Kinea Renda Imobiliária', 'Híbrido', 141.2, 0.11, 4.0, 6e4],
  ['MXRF11', 'Maxi Renda', 'Papel', 9.6, 0.1, 3.8, 3.2e6],
  ['XPML11', 'XP Malls', 'Shoppings', 104.7, 0.14, 5.2, 1.6e5],
  ['VISC11', 'Vinci Shopping Centers', 'Shoppings', 101.3, 0.13, 3.0, 9e4],
  ['BTLG11', 'BTG Pactual Logística', 'Logística', 99.8, 0.11, 4.4, 1.2e5],
  ['KNCR11', 'Kinea Rendimentos', 'Papel', 103.5, 0.06, 7.5, 1.8e5],
  ['HGBS11', 'Hedge Brasil Shopping', 'Shoppings', 21.1, 0.14, 2.4, 2.5e5],
]);

export const BR_ETFS = mk('BR', 'etf', 'BRL', 'B3', [
  ['BOVA11', 'iShares Ibovespa', 'Renda Variável BR', 124.6, 0.2, 14, 9e6],
  ['IVVB11', 'iShares S&P 500 (BRL)', 'Internacional', 338.9, 0.18, 7, 6e5],
  ['SMAL11', 'iShares Small Cap', 'Small Caps', 98.2, 0.25, 2.1, 1.2e6],
  ['DIVO11', 'It Now IDIV', 'Dividendos', 92.4, 0.17, 0.8, 1.5e5],
  ['HASH11', 'Hashdex Nasdaq Crypto', 'Cripto', 58.3, 0.6, 1.4, 6e5],
  ['GOLD11', 'Trend Ouro', 'Commodities', 19.7, 0.15, 0.9, 1.1e6],
]);

export const BR_BDRS = mk('BR', 'bdr', 'BRL', 'B3', [
  ['AAPL34', 'Apple BDR', 'Tecnologia', 64.2, 0.28, undefined, 4e5],
  ['NVDC34', 'NVIDIA BDR', 'Semicondutores', 17.9, 0.5, undefined, 2e6],
  ['MSFT34', 'Microsoft BDR', 'Tecnologia', 98.6, 0.25, undefined, 2e5],
  ['AMZO34', 'Amazon BDR', 'Consumo', 64.8, 0.32, undefined, 6e5],
  ['TSLA34', 'Tesla BDR', 'Automóveis', 95.3, 0.6, undefined, 5e5],
  ['GOGL34', 'Alphabet BDR', 'Tecnologia', 79.4, 0.3, undefined, 3e5],
]);

export const BR_INDICES = mk('BR', 'index', 'PTS', 'B3', [
  ['IBOV', 'Ibovespa', 'Índice', 128450, 0.19],
  ['IFIX', 'Índice de Fundos Imobiliários', 'Índice', 3285, 0.08],
  ['SMLL', 'Índice Small Cap', 'Índice', 2110, 0.25],
  ['IDIV', 'Índice Dividendos', 'Índice', 9120, 0.17],
], 0);

export const BR_FUTURES = mk('BR', 'future', 'PTS', 'B3', [
  ['WINZ26', 'Mini Índice Dez/26', 'Índice', 130250, 0.2, undefined, 2.4e6],
  ['WDOZ26', 'Mini Dólar Dez/26', 'Câmbio', 5482, 0.14, undefined, 3.1e5],
  ['DI1F27', 'DI Futuro Jan/27', 'Juros', 13.85, 0.05, undefined, 1.2e6],
  ['BGIZ26', 'Boi Gordo Dez/26', 'Agro', 312.4, 0.18, undefined, 6e3],
]);

export const BR_MACRO = [
  ...mk('BR', 'fx', 'BRL', 'Câmbio', [['USDBRL', 'Dólar Comercial', 'Câmbio', 5.47, 0.14]], 4),
  ...mk('BR', 'rate', 'PCT', 'BCB', [
    ['CDI', 'CDI (a.a.)', 'Juros', 13.65, 0.001],
    ['SELIC', 'Taxa Selic Meta (a.a.)', 'Juros', 13.75, 0.001],
  ], 2),
];

export const US_STOCKS = mk('US', 'stock', 'USD', 'NASDAQ', [
  ['AAPL', 'Apple Inc.', 'Tecnologia', 228.4, 0.26, 3460, 52e6],
  ['NVDA', 'NVIDIA Corp.', 'Semicondutores', 142.6, 0.52, 3500, 240e6],
  ['MSFT', 'Microsoft Corp.', 'Tecnologia', 421.3, 0.24, 3130, 21e6],
  ['AMZN', 'Amazon.com Inc.', 'Consumo', 201.7, 0.32, 2120, 41e6],
  ['GOOGL', 'Alphabet Inc. A', 'Comunicação', 176.2, 0.3, 2160, 26e6],
  ['META', 'Meta Platforms', 'Comunicação', 572.8, 0.38, 1450, 14e6],
  ['TSLA', 'Tesla Inc.', 'Automotivo', 248.5, 0.6, 795, 95e6],
  ['AMD', 'Advanced Micro Devices', 'Semicondutores', 148.9, 0.5, 241, 38e6],
  ['NFLX', 'Netflix Inc.', 'Comunicação', 812.4, 0.38, 348, 3.5e6],
  ['JPM', 'JPMorgan Chase', 'Financeiro', 224.6, 0.22, 632, 9e6],
  ['AVGO', 'Broadcom Inc.', 'Semicondutores', 171.3, 0.45, 800, 28e6],
  ['V', 'Visa Inc.', 'Financeiro', 289.7, 0.19, 560, 7e6],
  ['XOM', 'Exxon Mobil', 'Energia', 118.2, 0.24, 520, 15e6],
  ['KO', 'Coca-Cola Co.', 'Bens de Consumo', 66.4, 0.15, 286, 13e6],
  ['LLY', 'Eli Lilly', 'Saúde', 802.1, 0.32, 760, 3e6],
]);

export const US_ETFS = mk('US', 'etf', 'USD', 'NYSE Arca', [
  ['SPY', 'SPDR S&P 500 ETF', 'Grandes Empresas', 582.4, 0.17, 570, 45e6],
  ['QQQ', 'Invesco QQQ Trust', 'Nasdaq 100', 498.6, 0.22, 310, 35e6],
  ['IWM', 'iShares Russell 2000', 'Small Caps', 224.8, 0.24, 70, 30e6],
  ['DIA', 'SPDR Dow Jones ETF', 'Grandes Empresas', 428.1, 0.16, 33, 3e6],
  ['VOO', 'Vanguard S&P 500', 'Grandes Empresas', 535.6, 0.17, 520, 5e6],
  ['VTI', 'Vanguard Total Market', 'Mercado Total', 287.2, 0.17, 440, 3.5e6],
  ['GLD', 'SPDR Gold Shares', 'Ouro', 245.3, 0.15, 75, 8e6],
  ['TLT', 'iShares 20+ Yr Treasury', 'Títulos do Tesouro', 92.7, 0.16, 60, 40e6],
  ['ARKK', 'ARK Innovation ETF', 'Temático', 54.2, 0.55, 6, 15e6],
]);

export const US_REITS = mk('US', 'reit', 'USD', 'NYSE', [
  ['O', 'Realty Income', 'Varejo', 58.6, 0.2, 51, 5e6],
  ['PLD', 'Prologis', 'Logística', 118.4, 0.25, 110, 3.5e6],
  ['AMT', 'American Tower', 'Torres de Telecom', 208.9, 0.24, 97, 2.5e6],
  ['EQIX', 'Equinix', 'Data Centers', 874.2, 0.24, 84, 5e5],
  ['SPG', 'Simon Property Group', 'Varejo', 168.3, 0.24, 55, 1.5e6],
  ['VICI', 'VICI Properties', 'Cassinos', 32.1, 0.2, 34, 6e6],
]);

export const US_INDICES = mk('US', 'index', 'PTS', 'US', [
  ['SPX', 'S&P 500', 'Index', 5870, 0.16],
  ['NDX', 'Nasdaq 100', 'Index', 20680, 0.21],
  ['DJI', 'Dow Jones', 'Index', 43350, 0.15],
  ['RUT', 'Russell 2000', 'Index', 2290, 0.23],
  ['VIX', 'CBOE Volatility Index', 'Index', 16.4, 0.9],
], 2);

export const CRYPTO = mk('CRYPTO', 'crypto', 'USD', 'Cripto', [
  ['BTC', 'Bitcoin', 'Layer 1', 91200, 0.55, 1805, 4.2e5],
  ['ETH', 'Ethereum', 'Smart Contracts', 3180, 0.65, 383, 6e6],
  ['SOL', 'Solana', 'Smart Contracts', 214.5, 0.85, 102, 2.1e7],
  ['BNB', 'BNB', 'Exchange', 618.3, 0.5, 89, 3e6],
  ['XRP', 'XRP', 'Pagamentos', 1.12, 0.8, 64, 4e9],
  ['DOGE', 'Dogecoin', 'Meme', 0.382, 1.0, 56, 1.4e10],
  ['ADA', 'Cardano', 'Smart Contracts', 0.74, 0.85, 26, 1.6e9],
  ['AVAX', 'Avalanche', 'Smart Contracts', 34.8, 0.9, 14, 2.4e7],
  ['LINK', 'Chainlink', 'Oráculos', 15.6, 0.85, 9.8, 3e7],
  ['DOT', 'Polkadot', 'Interoperabilidade', 5.9, 0.85, 8.9, 4e7],
]);

export const ALL_ASSETS: Asset[] = [
  ...BR_INDICES, ...BR_MACRO, ...BR_STOCKS, ...BR_FIIS, ...BR_ETFS, ...BR_BDRS, ...BR_FUTURES,
  ...US_INDICES, ...US_STOCKS, ...US_ETFS, ...US_REITS,
  ...CRYPTO,
];

export const ASSET_MAP: Record<string, Asset> = Object.fromEntries(ALL_ASSETS.map((a) => [a.symbol, a]));

export const getAsset = (symbol: string): Asset | undefined => ASSET_MAP[symbol.toUpperCase()];

export const CLASS_LABEL: Record<Asset['cls'], string> = {
  stock: 'Ação', fii: 'FII', etf: 'ETF', bdr: 'BDR', index: 'Índice', future: 'Futuro',
  reit: 'REIT', crypto: 'Cripto', fx: 'Câmbio', rate: 'Taxa',
};

export const MARKET_LABEL: Record<Asset['market'], string> = {
  BR: 'Brasil', US: 'EUA', CRYPTO: 'Cripto',
};

/** Ativos com dados fundamentalistas (empresas/fundos). */
export const hasFundamentals = (a: Asset) => ['stock', 'fii', 'etf', 'bdr', 'reit'].includes(a.cls);

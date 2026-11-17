/** Mapeamento entre os tickers da plataforma e os identificadores de cada provedor. */
export const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
  DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', DOT: 'polkadot',
};

export const B3_SYMBOLS = new Set([
  'PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'WEGE3', 'BBDC4', 'PRIO3', 'MGLU3', 'ABEV3', 'B3SA3', 'SUZB3', 'RENT3', 'ELET3', 'RADL3', 'EQTL3', 'GGBR4', 'JBSS3', 'EMBR3',
  'HGLG11', 'KNRI11', 'MXRF11', 'XPML11', 'VISC11', 'BTLG11', 'KNCR11', 'HGBS11',
  'BOVA11', 'IVVB11', 'SMAL11', 'DIVO11', 'HASH11', 'GOLD11',
  'AAPL34', 'NVDC34', 'MSFT34', 'AMZO34', 'TSLA34', 'GOGL34',
]);
/** Índices B3 na brapi */
export const B3_INDEX = { IBOV: '^BVSP' };
/** Tickers liberados pela brapi sem token (plano de teste). */
export const BRAPI_FREE = new Set(['PETR4', 'VALE3', 'MGLU3', 'ITUB4']);

export const US_SYMBOLS = new Set([
  'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'NFLX', 'JPM', 'AVGO', 'V', 'XOM', 'KO', 'LLY',
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'GLD', 'TLT', 'ARKK', 'O', 'PLD', 'AMT', 'EQIX', 'SPG', 'VICI',
]);

export const BCB_SERIES = { SELIC: 432, CDI: 4389 };

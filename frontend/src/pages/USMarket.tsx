import { usePageMeta } from '../lib/pageMeta';
import { US_ETFS, US_INDICES, US_REITS, US_STOCKS } from '../data/universe';
import { C } from '../components/AssetTable';
import { MarketExplorer } from '../components/MarketExplorer';
import { DemoNotice, UpdatedAt } from '../components/ui';
import { CardRow, DayMovers } from '../components/MarketWidgets';
import { marketSession } from '../lib/marketHours';

const LIQ: [string, string, number, number][] = [
  ['alta', 'Alta (≥ US$ 2 bi/dia)', 2e9, Infinity],
  ['media', 'Média (US$ 200 mi–2 bi)', 2e8, 2e9],
  ['baixa', 'Baixa (< US$ 200 mi)', 0, 2e8],
];

export default function USMarket() {
  usePageMeta('Mercado Americano', 'Ações, ETFs, REITs e índices dos EUA (NYSE e Nasdaq) com preço em dólar, variação, volume, P/L e dividend yield.');
  const s = marketSession('US', 'stock');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mercado Americano <span className="tag us">NYSE · NASDAQ · USD</span></h1>
          <div className="sub">Pregão {s.isOpen ? 'aberto' : 'fechado'} · 9h30–16h00 (Nova York) · <UpdatedAt /></div>
        </div>
      </div>
      <DemoNotice />
      <CardRow items={[['SPX', 'S&P 500'], ['NDX', 'Nasdaq 100'], ['DJI', 'Dow Jones'], ['RUT', 'Russell 2000'], ['VIX', 'VIX']]} />
      <div style={{ marginTop: 12 }}><DayMovers groups={[['stocks', 'Ações', US_STOCKS], ['etfs', 'ETFs', US_ETFS], ['reits', 'REITs', US_REITS]]} /></div>
      <div style={{ marginTop: 12 }}>
        <MarketExplorer
          liquidity={LIQ}
          categories={[
            { id: 'stocks', label: 'Ações (Stocks)', assets: US_STOCKS, columns: [C.ticker(), C.sector('Setor'), C.price('Preço (US$)'), C.change(), C.changeAbs('Var. US$'), C.volume('Volume (US$)'), C.high(), C.low(), C.mcap(), C.pl('P/L (P/E)'), C.dy('Div. Yield'), C.star()] },
            { id: 'etfs', label: 'ETFs', assets: US_ETFS, columns: [C.ticker(), C.sector('Categoria'), C.price('Preço (US$)'), C.change(), C.volume('Volume (US$)'), C.high(), C.low(), C.fee('Taxa adm.'), C.dy('Div. Yield'), C.mcap('Patrimônio'), C.star()] },
            { id: 'reits', label: 'REITs', assets: US_REITS, columns: [C.ticker(), C.sector('Tipo'), C.price('Preço (US$)'), C.change(), C.volume('Volume (US$)'), C.high(), C.low(), C.mcap(), C.pl('P/FFO'), C.dy('Div. Yield'), C.star()] },
            { id: 'indices', label: 'Índices', assets: US_INDICES, columns: [C.ticker('Índice'), C.price('Pontos'), C.change(), C.changeAbs('Var. pts'), C.high(), C.low(), C.perf(21, '30 dias'), C.perf(252, '12 meses'), C.spark()], defaultSort: { key: 'ticker', dir: 1 } },
          ]}
        />
      </div>
    </>
  );
}

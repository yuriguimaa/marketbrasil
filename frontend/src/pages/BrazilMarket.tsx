import { usePageMeta } from '../lib/pageMeta';
import { BR_BDRS, BR_ETFS, BR_FIIS, BR_FUTURES, BR_INDICES, BR_STOCKS } from '../data/universe';
import { C } from '../components/AssetTable';
import { MarketExplorer } from '../components/MarketExplorer';
import { DemoNotice, UpdatedAt } from '../components/ui';
import { CardRow, DayMovers } from '../components/MarketWidgets';
import { marketSession } from '../lib/marketHours';

const LIQ: [string, string, number, number][] = [
  ['alta', 'Alta (≥ R$ 500 mi/dia)', 5e8, Infinity],
  ['media', 'Média (R$ 50–500 mi)', 5e7, 5e8],
  ['baixa', 'Baixa (< R$ 50 mi)', 0, 5e7],
];

export default function BrazilMarket() {
  usePageMeta('Mercado Brasileiro', 'Ações, FIIs, ETFs, BDRs, índices e futuros da B3 com cotação, variação, volume, P/L, dividend yield e market cap.');
  const s = marketSession('BR', 'stock');
  const stockCols = [C.ticker(), C.sector(), C.price('Último (R$)'), C.change(), C.changeAbs(), C.volume('Volume (R$)'), C.high(), C.low(), C.pl(), C.dy(), C.mcap(), C.star()];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mercado Brasileiro <span className="tag br">B3 · BRL</span></h1>
          <div className="sub">Pregão {s.isOpen ? 'aberto' : 'fechado'} · 10h00–17h00 (Brasília) · <UpdatedAt /></div>
        </div>
      </div>
      <DemoNotice />
      <CardRow items={[['IBOV', 'Ibovespa'], ['IFIX', 'IFIX'], ['SMLL', 'Small Caps'], ['IDIV', 'Dividendos'], ['USDBRL', 'Dólar'], ['BOVA11', 'BOVA11 (ETF Ibovespa)']]} />
      <div style={{ marginTop: 12 }}><DayMovers groups={[['acoes', 'Ações', BR_STOCKS], ['fiis', 'FIIs', BR_FIIS], ['etfs', 'ETFs', BR_ETFS], ['bdrs', 'BDRs', BR_BDRS]]} /></div>
      <div style={{ marginTop: 12 }}>
        <MarketExplorer
          liquidity={LIQ}
          categories={[
            { id: 'acoes', label: 'Ações', assets: BR_STOCKS, columns: stockCols },
            { id: 'fiis', label: 'FIIs', assets: BR_FIIS, columns: [C.ticker(), C.sector('Segmento'), C.price('Último (R$)'), C.change(), C.volume('Volume (R$)'), C.high(), C.low(), C.pvp(), C.dy('DY 12m'), C.mcap('Patrimônio'), C.star()] },
            { id: 'etfs', label: 'ETFs', assets: BR_ETFS, columns: [C.ticker(), C.sector('Categoria'), C.price('Último (R$)'), C.change(), C.volume('Volume (R$)'), C.high(), C.low(), C.fee(), C.mcap('Patrimônio'), C.star()] },
            { id: 'bdrs', label: 'BDRs', assets: BR_BDRS, columns: [C.ticker(), C.sector(), C.price('Último (R$)'), C.change(), C.volume('Volume (R$)'), C.high(), C.low(), C.pl(), C.dy(), C.star()] },
            { id: 'indices', label: 'Índices', assets: BR_INDICES, columns: [C.ticker('Índice'), C.price('Pontos'), C.change(), C.changeAbs('Var. pts'), C.high(), C.low(), C.perf(21, '30 dias'), C.perf(252, '12 meses'), C.spark()], defaultSort: { key: 'ticker', dir: 1 } },
            { id: 'futuros', label: 'Futuros', assets: BR_FUTURES, columns: [C.ticker('Contrato'), C.sector('Tipo'), C.price('Último'), C.change(), C.changeAbs('Var.'), C.qty('Contratos'), C.high(), C.low(), C.spark()], defaultSort: { key: 'qty', dir: -1 },
              notice: <><b>Demonstração</b><span>Os contratos futuros da B3 (mini índice, mini dólar, DI e boi gordo) têm dados fictícios nesta tabela, pois não há fonte gratuita de cotação para eles. Clique em um contrato para ver a cotação real no gráfico do TradingView (até 15 min de atraso).</span></> },
          ]}
        />
      </div>
    </>
  );
}

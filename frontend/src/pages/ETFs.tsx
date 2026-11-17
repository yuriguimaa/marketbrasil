import { usePageMeta } from '../lib/pageMeta';
import { BR_ETFS, US_ETFS } from '../data/universe';
import { C } from '../components/AssetTable';
import { MarketExplorer } from '../components/MarketExplorer';
import { DemoNotice, UpdatedAt } from '../components/ui';

export default function ETFs() {
  usePageMeta('ETFs', 'ETFs negociados na B3 e nos EUA: desempenho em 30 dias e 12 meses, taxa de administração, dividend yield e patrimônio.');
  const cols = (cur: string) => [C.ticker(), C.sector('Categoria'), C.price(`Preço (${cur})`), C.change(), C.perf(21, '30 dias'), C.perf(252, '12 meses'), C.volume(`Volume (${cur})`), C.fee(), C.dy(), C.mcap('Patrimônio'), C.star()];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>ETFs</h1>
          <div className="sub">Fundos de índice negociados na B3 e nos EUA · <UpdatedAt /></div>
        </div>
      </div>
      <DemoNotice />
      <MarketExplorer
        liquidity={[['alta', 'Alta (≥ 100 mi/dia)', 1e8, Infinity], ['media', 'Média (10–100 mi)', 1e7, 1e8], ['baixa', 'Baixa (< 10 mi)', 0, 1e7]]}
        categories={[
          { id: 'br', label: 'ETFs na B3 (BRL)', assets: BR_ETFS, columns: cols('R$') },
          { id: 'us', label: 'ETFs nos EUA (USD)', assets: US_ETFS, columns: cols('US$') },
        ]}
      />
    </>
  );
}

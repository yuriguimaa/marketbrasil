import { usePageMeta } from '../lib/pageMeta';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BR_STOCKS, CRYPTO, getAsset, US_STOCKS } from '../data/universe';
import { AssetTable, C } from '../components/AssetTable';
import { PriceChart } from '../components/PriceChart';
import { NewsRow, useNews } from '../components/NewsList';
import { DemoNotice, Panel, Seg, UpdatedAt } from '../components/ui';
import { CardRow, Heatmap, Movers } from '../components/MarketWidgets';

const BR_CARDS: [string, string][] = [['IBOV', 'Ibovespa'], ['USDBRL', 'Dólar (USD/BRL)'], ['IFIX', 'IFIX'], ['CDI', 'CDI'], ['SELIC', 'Selic']];
const US_CARDS: [string, string][] = [['SPX', 'S&P 500'], ['NDX', 'Nasdaq 100'], ['DJI', 'Dow Jones'], ['RUT', 'Russell 2000'], ['VIX', 'VIX']];
const CR_CARDS: [string, string][] = [['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['BNB', 'BNB']];

const CHART_TABS: [string, string][] = [['IBOV', 'Ibovespa'], ['USDBRL', 'Dólar'], ['SPX', 'S&P 500'], ['NDX', 'Nasdaq'], ['BTC', 'Bitcoin']];

export default function Dashboard() {
  usePageMeta('', 'Panorama do mercado: Ibovespa, dólar, Selic, CDI, S&P 500, Nasdaq, Bitcoin e as principais ações do Brasil e dos EUA, com gráficos e notícias.');
  const [chartSym, setChartSym] = useState('IBOV');
  const [moversMkt, setMoversMkt] = useState<'BR' | 'US'>('BR');
  const news = useNews();
  const cols = [C.ticker(), C.price(), C.change(), C.volume(), C.spark()];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visão Geral</h1>
          <div className="sub"><UpdatedAt /></div>
        </div>
      </div>
      <DemoNotice />

      <h2 className="section-label">Brasil</h2>
      <CardRow items={BR_CARDS} />
      <h2 className="section-label" style={{ marginTop: 14 }}>Estados Unidos</h2>
      <CardRow items={US_CARDS} />
      <h2 className="section-label" style={{ marginTop: 14 }}>◆ Criptomoedas</h2>
      <CardRow items={CR_CARDS} />

      <div className="grid g-main" style={{ marginTop: 16 }}>
        <Panel flush title={<Seg value={chartSym} options={CHART_TABS} onChange={setChartSym} />}
          right={<Link to={'/ativo/' + chartSym} className="link">Abrir análise →</Link>}>
          <PriceChart asset={getAsset(chartSym)!} height={360} defaultPeriod="1D" />
        </Panel>
        <Panel flush title="Destaques do dia" right={<Seg value={moversMkt} options={[['BR', 'B3'], ['US', 'EUA']]} onChange={setMoversMkt} />}>
          <Movers assets={moversMkt === 'BR' ? BR_STOCKS : US_STOCKS} />
        </Panel>
      </div>

      <div className="grid g-2" style={{ marginTop: 12 }}>
        <Panel flush title={<h2>Ações brasileiras <span className="tag br" style={{ marginLeft: 6 }}>B3 · BRL</span></h2>} right={<Link to="/brasil" className="link">Ver todas →</Link>}>
          <AssetTable assets={BR_STOCKS} columns={cols} limit={10} defaultSort={{ key: 'vol', dir: -1 }} />
        </Panel>
        <Panel flush title={<h2>Ações americanas <span className="tag us" style={{ marginLeft: 6 }}>NYSE/NASDAQ · USD</span></h2>} right={<Link to="/eua" className="link">Ver todas →</Link>}>
          <AssetTable assets={US_STOCKS} columns={cols} limit={10} defaultSort={{ key: 'vol', dir: -1 }} />
        </Panel>
      </div>

      <div className="grid g-main" style={{ marginTop: 12 }}>
        <div className="stack">
          <Panel flush title={<h2>◆ Criptomoedas <span className="tag crypto" style={{ marginLeft: 6 }}>USD · 24h</span></h2>} right={<Link to="/cripto" className="link">Ver todas →</Link>}>
            <AssetTable assets={CRYPTO.slice(0, 8)} columns={[C.ticker(), C.price('Preço'), C.change('24h'), C.mcap(), C.volume('Volume 24h'), C.spark('24h')]} defaultSort={{ key: 'mcap', dir: -1 }} />
          </Panel>
          <Panel title="Mapa de calor · Ações B3">
            <Heatmap assets={BR_STOCKS} />
          </Panel>
        </div>
        <Panel flush title="Principais notícias do mercado" right={<Link to="/noticias" className="link">Todas →</Link>}
          foot={news ? (news.live ? 'Fontes: portais financeiros brasileiros (RSS)' : 'Manchetes de exemplo — backend de notícias desconectado') : 'Carregando…'}>
          {(news?.items ?? []).slice(0, 9).map((n) => <NewsRow key={n.id} n={n} compact />)}
        </Panel>
      </div>
    </>
  );
}

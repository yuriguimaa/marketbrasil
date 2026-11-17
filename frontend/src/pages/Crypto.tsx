import { usePageMeta } from '../lib/pageMeta';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CRYPTO, getAsset } from '../data/universe';
import { AssetTable, C } from '../components/AssetTable';
import { PriceChart } from '../components/PriceChart';
import { DemoNotice, Panel, Seg, UpdatedAt } from '../components/ui';
import { DayMovers } from '../components/MarketWidgets';
import { useMarket } from '../services/marketData';
import { compact, pct } from '../lib/format';

export default function Crypto() {
  usePageMeta('Criptomoedas', 'Bitcoin, Ethereum, Solana, BNB, XRP e outras criptomoedas: preço em dólar, variação 24h, market cap e volume.');
  const [sym, setSym] = useState('BTC');
  const [cap, setCap] = useState('all');
  const [perf, setPerf] = useState('all');
  const quotes = useMarket((s) => s.quotes);

  const totals = useMemo(() => {
    const mc = CRYPTO.reduce((s, a) => s + (quotes[a.symbol]?.marketCap ?? 0), 0);
    const vol = CRYPTO.reduce((s, a) => s + (quotes[a.symbol]?.volumeFin ?? 0), 0);
    const btc = quotes.BTC?.marketCap ?? 0, eth = quotes.ETH?.marketCap ?? 0;
    const ups = CRYPTO.filter((a) => (quotes[a.symbol]?.changePct ?? 0) > 0).length;
    return { mc, vol, btcDom: mc ? (btc / mc) * 100 : 0, ethDom: mc ? (eth / mc) * 100 : 0, ups };
  }, [quotes]);

  const list = useMemo(() => CRYPTO.filter((a) => {
    const q = quotes[a.symbol];
    if (!q) return true;
    const m = q.marketCap ?? 0;
    if (cap === 'large' && m < 1e11) return false;
    if (cap === 'mid' && (m < 1e10 || m >= 1e11)) return false;
    if (cap === 'small' && m >= 1e10) return false;
    if (perf === 'up' && q.changePct <= 0) return false;
    if (perf === 'down' && q.changePct >= 0) return false;
    return true;
  }), [quotes, cap, perf]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>◆ Criptomoedas <span className="tag crypto">24/7 · USD</span></h1>
          <div className="sub"><UpdatedAt /></div>
        </div>
      </div>
      <DemoNotice />
      <div className="stat-strip">
        <div><div className="k">Market cap (ativos listados)</div><div className="v num">{compact(totals.mc, 'USD')}</div></div>
        <div><div className="k">Volume 24h</div><div className="v num">{compact(totals.vol, 'USD')}</div></div>
        <div><div className="k">Dominância BTC</div><div className="v num">{pct(totals.btcDom, 1, false)}</div></div>
        <div><div className="k">Dominância ETH</div><div className="v num">{pct(totals.ethDom, 1, false)}</div></div>
        <div><div className="k">Em alta (24h)</div><div className="v num">{totals.ups} / {CRYPTO.length}</div></div>
      </div>
      <Panel flush title={<Seg value={sym} options={CRYPTO.slice(0, 8).map((a) => [a.symbol, a.symbol] as [string, string])} onChange={setSym} />}
        right={<Link to={'/ativo/' + sym} className="link">Análise completa de {getAsset(sym)!.name} →</Link>}>
        <PriceChart asset={getAsset(sym)!} height={340} defaultPeriod="1M" defaultType="area" />
      </Panel>
      <div style={{ marginTop: 12 }}><DayMovers title="Maiores altas e baixas em 24h" groups={[['all', 'Todas', CRYPTO]]} /></div>
      <div style={{ marginTop: 12 }}>
        <Panel flush title="Mercado cripto"
          right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Seg value={cap} options={[['all', 'Todas'], ['large', 'Large cap'], ['mid', 'Mid cap'], ['small', 'Small cap']]} onChange={setCap} />
            <Seg value={perf} options={[['all', 'Todas'], ['up', 'Em alta'], ['down', 'Em queda']]} onChange={setPerf} />
          </div>}
          foot="Large cap ≥ US$ 100 bi · Mid cap US$ 10–100 bi · Small cap < US$ 10 bi">
          <AssetTable assets={list} defaultSort={{ key: 'mcap', dir: -1 }}
            columns={[C.ticker('Nome'), C.price('Preço (US$)'), C.change('Var. 24h'), C.changeAbs('Var. US$'), C.mcap(), C.volume('Volume 24h'), C.high('Máx. 24h'), C.low('Mín. 24h'), C.perf(7, '7 dias'), C.spark('24h'), C.star()]} />
        </Panel>
      </div>
    </>
  );
}

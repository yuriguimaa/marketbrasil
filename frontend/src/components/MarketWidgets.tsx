/** Blocos de mercado reutilizados pela Visão Geral e pelas páginas de mercado. */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAsset } from '../data/universe';
import { useMarket } from '../services/marketData';
import type { Asset } from '../types';
import { price } from '../lib/format';
import { Change, Logo, MarketCard, Panel, Seg } from './ui';
import { useState } from 'react';

export function CardRow({ items }: { items: [string, string][] }) {
  return <div className="cards">{items.map(([s, l]) => <MarketCard key={s} a={getAsset(s)!} label={l} />)}</div>;
}

export function Movers({ assets, n = 5 }: { assets: Asset[]; n?: number }) {
  const quotes = useMarket((s) => s.quotes);
  const sorted = useMemo(() => assets.filter((a) => quotes[a.symbol]).sort((a, b) => quotes[b.symbol].changePct - quotes[a.symbol].changePct), [assets, quotes]);
  const ups = sorted.filter((a) => quotes[a.symbol].changePct > 0).length;
  const downs = sorted.filter((a) => quotes[a.symbol].changePct < 0).length;
  const list = (xs: Asset[]) => xs.map((a) => (
    <Link key={a.symbol} to={'/ativo/' + a.symbol} className="list-row">
      <b style={{ width: 64 }}>{a.symbol}</b>
      <span className="muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{a.name}</span>
      <Change v={quotes[a.symbol].changePct} box />
    </Link>
  ));
  return (
    <>
      <div style={{ padding: '10px 14px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
          <span className="up">{ups} em alta</span><span className="dim">{sorted.length - ups - downs} estáveis</span><span className="down">{downs} em queda</span>
        </div>
        <div className="breadth">
          <span style={{ width: (sorted.length ? ups / sorted.length : 0) * 100 + '%', background: 'var(--up)' }} />
          <span style={{ flex: 1 }} />
          <span style={{ width: (sorted.length ? downs / sorted.length : 0) * 100 + '%', background: 'var(--down)' }} />
        </div>
      </div>
      <div className="section-label" style={{ margin: '12px 14px 0' }}>Maiores altas</div>
      {list(sorted.filter((a) => quotes[a.symbol].changePct > 0).slice(0, n))}{!ups && <div className="empty">Nenhuma alta no momento.</div>}
      <div className="section-label" style={{ margin: '12px 14px 0' }}>Maiores quedas</div>
      {list(sorted.filter((a) => quotes[a.symbol].changePct < 0).slice(-n).reverse())}{!downs && <div className="empty">Nenhuma queda no momento.</div>}
    </>
  );
}

export function Heatmap({ assets }: { assets: Asset[] }) {
  const quotes = useMarket((s) => s.quotes);
  const color = (v: number) => {
    const k = Math.min(1, Math.abs(v) / 3);
    return v >= 0 ? `rgba(31,191,117,${0.12 + k * 0.6})` : `rgba(239,69,82,${0.12 + k * 0.6})`;
  };
  return (
    <div className="heat">
      {assets.map((a) => {
        const q = quotes[a.symbol];
        return (
          <Link key={a.symbol} to={'/ativo/' + a.symbol} style={{ background: color(q?.changePct ?? 0) }} title={a.name} aria-label={`${a.symbol}, ${a.name}: ${q ? q.changePct.toFixed(2) + '%' : 'sem dados'}`}>
            <b>{a.symbol}</b><span className="num" style={{ color: 'rgba(255,255,255,.85)' }}>{q ? (q.changePct > 0 ? '+' : '') + q.changePct.toFixed(2).replace('.', ',') + '%' : '—'}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Faixa do dia: posição do preço atual entre a mínima e a máxima. */
export function DayRange({ lo, hi, v, a }: { lo?: number; hi?: number; v: number; a: Asset }) {
  if (lo == null || hi == null || !(hi > lo)) return <span className="dim range-cell">—</span>;
  const p = Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100;
  return (
    <span className="range-cell" title={`Mínima ${price(lo, a)} · Máxima ${price(hi, a)}`}>
      <span className="num dim">{price(lo, a)}</span>
      <span className="range-bar"><i style={{ left: p + '%' }} /></span>
      <span className="num dim">{price(hi, a)}</span>
    </span>
  );
}

/** Maiores altas e baixas do dia, lado a lado, com preço e faixa mínima–máxima. */
export function DayMovers({ groups, n = 5, title = 'Maiores altas e baixas do dia' }: { groups: [string, string, Asset[]][]; n?: number; title?: string }) {
  const quotes = useMarket((s) => s.quotes);
  const [g, setG] = useState(groups[0][0]);
  const assets = (groups.find((x) => x[0] === g) ?? groups[0])[2];
  const { ups, downs, total } = useMemo(() => {
    const xs = assets.filter((a) => quotes[a.symbol] && isFinite(quotes[a.symbol].changePct));
    const by = [...xs].sort((a, b) => quotes[b.symbol].changePct - quotes[a.symbol].changePct);
    return { ups: by.filter((a) => quotes[a.symbol].changePct > 0).slice(0, n), downs: by.filter((a) => quotes[a.symbol].changePct < 0).reverse().slice(0, n), total: xs.length };
  }, [assets, quotes, n]);
  const col = (label: string, xs: Asset[], cls: string, empty: string) => (
    <div className="movers-col">
      <div className={'movers-head ' + cls}>{label}</div>
      {xs.length ? xs.map((a) => {
        const q = quotes[a.symbol];
        return (
          <Link key={a.symbol} to={'/ativo/' + a.symbol} className="list-row mover-row">
            <Logo a={a} size={22} />
            <span className="mover-id"><b>{a.symbol}</b><span className="dim">{a.name}</span></span>
            <DayRange lo={q.low} hi={q.high} v={q.price} a={a} />
            <span className="num mover-px">{price(q.price, a)}</span>
            <Change v={q.changePct} box />
          </Link>
        );
      }) : <div className="empty">{empty}</div>}
    </div>
  );
  return (
    <Panel flush title={<h2>{title}</h2>} right={groups.length > 1 ? <Seg value={g} options={groups.map(([id, l]) => [id, l] as [string, string])} onChange={setG} /> : undefined}
      foot={`${total} ativos com cotação · faixa = mínima e máxima do dia`}>
      <div className="movers-grid">
        {col('Maiores altas', ups, 'up', 'Nenhum ativo em alta agora.')}
        {col('Maiores baixas', downs, 'down', 'Nenhum ativo em queda agora.')}
      </div>
    </Panel>
  );
}

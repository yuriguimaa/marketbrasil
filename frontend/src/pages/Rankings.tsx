import { usePageMeta } from '../lib/pageMeta';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BR_FIIS, BR_STOCKS, US_REITS, US_STOCKS } from '../data/universe';
import { DemoNotice, Panel, Seg, UpdatedAt } from '../components/ui';
import { fundamentalsSync, perf, useMarket } from '../services/marketData';
import { compact, dirClass, num, pct } from '../lib/format';
import type { Asset, Fundamentals, Quote } from '../types';

type R = { a: Asset; q: Quote; f: Fundamentals };
interface RankDef { title: string; desc: string; value: (r: R) => number | undefined; fmt: (v: number, r: R) => string; dir: 1 | -1; colored?: boolean; filter?: (r: R) => boolean }

/** Score composto simples: ROE alto, P/L baixo, dívida baixa, margem alta. */
const quality = (f: Fundamentals) => {
  if (f.roe == null || f.pl == null) return undefined;
  return (f.roe / 30) * 35 + Math.max(0, 1 - f.pl / 30) * 25 + Math.max(0, 1 - (f.divLiqEbitda ?? 1) / 4) * 20 + ((f.margemLiq ?? 10) / 40) * 20;
};

const RANKS: RankDef[] = [
  { title: 'Maiores altas do dia', desc: 'Variação % no dia', value: (r) => r.q.changePct, fmt: (v) => pct(v), dir: -1, colored: true },
  { title: 'Maiores quedas do dia', desc: 'Variação % no dia', value: (r) => r.q.changePct, fmt: (v) => pct(v), dir: 1, colored: true },
  { title: 'Maior volume financeiro', desc: 'Volume negociado hoje', value: (r) => r.q.volumeFin, fmt: (v, r) => compact(v, r.a.unit), dir: -1 },
  { title: 'Maior valorização em 30 dias', desc: 'Variação em ~21 pregões', value: (r) => perf(r.a, 21), fmt: (v) => pct(v), dir: -1, colored: true },
  { title: 'Maior valorização em 12 meses', desc: 'Variação em ~252 pregões', value: (r) => perf(r.a, 252), fmt: (v) => pct(v), dir: -1, colored: true },
  { title: 'Maiores dividend yields', desc: 'DY últimos 12 meses', value: (r) => r.f.dy, fmt: (v) => pct(v, 2, false), dir: -1 },
  { title: 'Menores P/L', desc: 'Preço / Lucro (positivo)', value: (r) => r.f.pl, fmt: (v) => num(v, 1), dir: 1, filter: (r) => (r.f.pl ?? 0) > 0 },
  { title: 'Melhores fundamentos', desc: 'Score: ROE, P/L, dívida e margem', value: (r) => quality(r.f), fmt: (v) => num(v, 0) + ' pts', dir: -1 },
];

export default function Rankings() {
  usePageMeta('Rankings', 'Maiores altas e quedas do dia, maior volume, valorização em 30 dias e 12 meses, maiores dividend yields e menores P/L.');
  const [mkt, setMkt] = useState<'BR' | 'US'>('BR');
  const [universe, setUniverse] = useState<'stocks' | 'reits'>('stocks');
  const [n, setN] = useState(5);
  const quotes = useMarket((s) => s.quotes);
  const assets = mkt === 'BR' ? (universe === 'stocks' ? BR_STOCKS : BR_FIIS) : (universe === 'stocks' ? US_STOCKS : US_REITS);

  const rows: R[] = useMemo(() => assets.filter((a) => quotes[a.symbol]).map((a) => ({ a, q: quotes[a.symbol], f: fundamentalsSync(a) })), [assets, quotes]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rankings</h1>
          <div className="sub">Melhores e piores desempenhos · <UpdatedAt /></div>
        </div>
        <div className="actions">
          <Seg value={mkt} options={[['BR', 'Brasil'], ['US', 'Estados Unidos']]} onChange={setMkt} />
          <Seg value={universe} options={[['stocks', 'Ações'], ['reits', mkt === 'BR' ? 'FIIs' : 'REITs']]} onChange={setUniverse} />
          <Seg value={String(n) as '5' | '10'} options={[['5', 'Top 5'], ['10', 'Top 10']]} onChange={(v) => setN(+v)} />
        </div>
      </div>
      <DemoNotice />
      <div className="grid g-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {RANKS.map((rk) => {
          const list = rows.filter((r) => rk.value(r) != null && (!rk.filter || rk.filter(r)))
            .sort((x, y) => (rk.value(x)! - rk.value(y)!) * rk.dir).slice(0, n);
          return (
            <Panel key={rk.title} flush title={<div><h3>{rk.title}</h3><div className="dim" style={{ fontSize: 11 }}>{rk.desc}</div></div>}>
              {list.length ? list.map((r, i) => {
                const v = rk.value(r)!;
                return (
                  <Link key={r.a.symbol} to={'/ativo/' + r.a.symbol} className="list-row">
                    <span className="dim num" style={{ width: 16 }}>{i + 1}</span>
                    <b style={{ width: 62 }}>{r.a.symbol}</b>
                    <span className="muted" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{r.a.name}</span>
                    <span className={'num ' + (rk.colored ? dirClass(v) : '')} style={{ fontWeight: 600 }}>{rk.fmt(v, r)}</span>
                  </Link>
                );
              }) : <div className="empty">Sem dados para este critério.</div>}
            </Panel>
          );
        })}
      </div>
    </>
  );
}

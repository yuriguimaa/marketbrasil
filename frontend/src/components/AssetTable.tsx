import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Asset, Fundamentals, Quote } from '../types';
import { compact, dirClass, num, pct, price, signed } from '../lib/format';
import { fundamentalsSync, perf, useMarket } from '../services/marketData';
import { Change, Flash, Sparkline, StarButton, TickerCell } from './ui';

export interface Row { a: Asset; q?: Quote; f: Fundamentals; spark?: number[] }

export interface Col {
  key: string;
  label: string;
  left?: boolean;
  render: (r: Row) => ReactNode;
  sort?: (r: Row) => number | string | undefined;
  className?: string;
  title?: string;
}

/** Biblioteca de colunas reutilizáveis. */
export const C = {
  ticker: (label = 'Ativo'): Col => ({ key: 'ticker', label, left: true, render: (r) => <TickerCell a={r.a} q={r.q} />, sort: (r) => r.a.symbol }),
  price: (label = 'Último'): Col => ({ key: 'price', label, render: (r) => <Flash value={r.q?.price} className="num">{price(r.q?.price, r.a)}</Flash>, sort: (r) => r.q?.price }),
  change: (label = 'Var. dia'): Col => ({ key: 'chg', label, render: (r) => <Change v={r.q?.changePct} box />, sort: (r) => r.q?.changePct }),
  changeAbs: (label = 'Var. R$'): Col => ({ key: 'chgAbs', label, render: (r) => <span className={'num ' + dirClass(r.q?.change)}>{signed(r.q?.change, r.a.unit === 'PTS' && r.a.decimals === 0 ? 0 : 2)}</span>, sort: (r) => r.q?.change }),
  volume: (label = 'Volume'): Col => ({ key: 'vol', label, render: (r) => <span className="num muted">{compact(r.q?.volumeFin, r.a.unit === 'PTS' ? undefined : r.a.unit)}</span>, sort: (r) => r.q?.volumeFin, title: 'Volume financeiro negociado' }),
  qty: (label = 'Qtd. negociada'): Col => ({ key: 'qty', label, render: (r) => <span className="num muted">{compact(r.q?.volume)}</span>, sort: (r) => r.q?.volume }),
  high: (label = 'Máx.'): Col => ({ key: 'hi', label, render: (r) => <span className="num muted">{price(r.q?.high, r.a)}</span>, sort: (r) => r.q?.high }),
  low: (label = 'Mín.'): Col => ({ key: 'lo', label, render: (r) => <span className="num muted">{price(r.q?.low, r.a)}</span>, sort: (r) => r.q?.low }),
  pl: (label = 'P/L'): Col => ({ key: 'pl', label, render: (r) => <span className="num">{num(r.f.pl, 1)}</span>, sort: (r) => r.f.pl }),
  pvp: (label = 'P/VP'): Col => ({ key: 'pvp', label, render: (r) => <span className="num">{num(r.f.pvp, 2)}</span>, sort: (r) => r.f.pvp }),
  roe: (label = 'ROE'): Col => ({ key: 'roe', label, render: (r) => <span className="num">{pct(r.f.roe, 1, false)}</span>, sort: (r) => r.f.roe }),
  dy: (label = 'DY'): Col => ({ key: 'dy', label, render: (r) => <span className="num">{pct(r.f.dy, 2, false)}</span>, sort: (r) => r.f.dy }),
  fee: (label = 'Taxa adm.'): Col => ({ key: 'fee', label, render: (r) => <span className="num muted">{pct(r.f.taxaAdm, 2, false)}</span>, sort: (r) => r.f.taxaAdm }),
  mcap: (label = 'Market Cap'): Col => ({ key: 'mcap', label, render: (r) => <span className="num muted">{compact(r.q?.marketCap, r.a.unit)}</span>, sort: (r) => r.q?.marketCap }),
  perf: (days: number, label: string): Col => ({ key: 'perf' + days, label, render: (r) => <Change v={perf(r.a, days)} />, sort: (r) => perf(r.a, days) }),
  spark: (label = 'Hoje'): Col => ({ key: 'spark', label, render: (r) => <Sparkline data={r.spark ?? []} width={72} height={22} up={(r.q?.change ?? 0) >= 0} />, className: 'hide-sm' }),
  sector: (label = 'Setor'): Col => ({ key: 'sector', label, left: true, render: (r) => <span className="muted">{r.a.sector}</span>, sort: (r) => r.a.sector, className: 'hide-sm' }),
  star: (): Col => ({ key: 'star', label: '', render: (r) => <StarButton symbol={r.a.symbol} /> }),
};

interface Props {
  assets: Asset[];
  columns: Col[];
  defaultSort?: { key: string; dir: 1 | -1 };
  limit?: number;
  maxHeight?: number;
  empty?: string;
}

export function AssetTable({ assets, columns, defaultSort, limit, maxHeight, empty = 'Nenhum ativo encontrado.' }: Props) {
  const quotes = useMarket((s) => s.quotes);
  const sparks = useMarket((s) => s.sparks);
  const nav = useNavigate();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | undefined>(defaultSort);

  const rows = useMemo(() => {
    const rs: Row[] = assets.map((a) => ({ a, q: quotes[a.symbol], f: fundamentalsSync(a), spark: sparks[a.symbol] }));
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sort) {
      rs.sort((x, y) => {
        const a = col.sort!(x), b = col.sort!(y);
        if (a == null) return 1;
        if (b == null) return -1;
        return (typeof a === 'string' ? a.localeCompare(b as string) : (a as number) - (b as number)) * sort!.dir;
      });
    }
    return limit ? rs.slice(0, limit) : rs;
  }, [assets, quotes, sparks, sort, columns, limit]);

  const clickSort = (c: Col) => {
    if (!c.sort) return;
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.left ? 1 : -1 }));
  };

  return (
    <div className="table-wrap" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table className="t">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={(c.left ? 'l ' : '') + (c.sort ? 'sortable ' : '') + (c.className ?? '')} title={c.title}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button type="button" className="th-btn" onClick={() => clickSort(c)} aria-label={c.label ? `Ordenar por ${c.label}` : undefined}>
                    {c.label}<span className="arr" aria-hidden="true">{sort?.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.a.symbol} className="click" tabIndex={0} aria-label={`Abrir ${r.a.symbol}, ${r.a.name}`}
              onClick={() => nav('/ativo/' + r.a.symbol)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); nav('/ativo/' + r.a.symbol); } }}>
              {columns.map((c) => <td key={c.key} className={(c.left ? 'l ' : '') + (c.className ?? '')}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">{empty}</div>}
    </div>
  );
}

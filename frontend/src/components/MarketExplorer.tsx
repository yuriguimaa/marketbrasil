import { useMemo, useState } from 'react';
import type { Asset } from '../types';
import { AssetTable, type Col } from './AssetTable';
import { Panel, Tabs } from './ui';
import { useMarket } from '../services/marketData';

export interface Category { id: string; label: string; assets: Asset[]; columns: Col[]; defaultSort?: { key: string; dir: 1 | -1 }; notice?: React.ReactNode }

/** Tabela com categorias + filtros por setor, liquidez e desempenho. Reutilizada por BR, EUA, Cripto e ETFs. */
export function MarketExplorer({ categories, liquidity, title, foot }: {
  categories: Category[];
  liquidity: [string, string, number, number][]; // id, label, min, max (volume financeiro)
  title?: React.ReactNode;
  foot?: React.ReactNode;
}) {
  const [cat, setCat] = useState(categories[0].id);
  const [sector, setSector] = useState('');
  const [liq, setLiq] = useState('');
  const [perf, setPerf] = useState('');
  const [q, setQ] = useState('');
  const quotes = useMarket((s) => s.quotes);
  const c = categories.find((x) => x.id === cat)!;
  const sectors = useMemo(() => Array.from(new Set(c.assets.map((a) => a.sector).filter(Boolean))).sort() as string[], [c]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const L = liquidity.find((l) => l[0] === liq);
    return c.assets.filter((a) => {
      const qt = quotes[a.symbol];
      if (sector && a.sector !== sector) return false;
      if (t && !a.symbol.toLowerCase().includes(t) && !a.name.toLowerCase().includes(t)) return false;
      if (L && qt && (qt.volumeFin < L[2] || qt.volumeFin >= L[3])) return false;
      if (perf === 'up' && !(qt && qt.changePct > 0)) return false;
      if (perf === 'down' && !(qt && qt.changePct < 0)) return false;
      if (perf === 'up2' && !(qt && qt.changePct >= 2)) return false;
      if (perf === 'down2' && !(qt && qt.changePct <= -2)) return false;
      return true;
    });
  }, [c, sector, liq, perf, q, quotes, liquidity]);

  const reset = () => { setSector(''); setLiq(''); setPerf(''); setQ(''); };

  return (
    <Panel flush title={title} foot={foot ?? <span>{filtered.length} de {c.assets.length} ativos · clique no cabeçalho para ordenar</span>}>
      <div style={{ padding: '0 14px' }}>
        <Tabs value={cat} options={categories.map((x) => [x.id, x.label, x.assets.length])} onChange={(v) => { setCat(v); reset(); }} />
        <div className="filters">
          <input className="input" placeholder="Filtrar por ticker ou nome" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} aria-label="Filtrar" />
          {sectors.length > 1 && (
            <select className="select" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Setor">
              <option value="">Todos os setores</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="select" value={liq} onChange={(e) => setLiq(e.target.value)} aria-label="Liquidez">
            <option value="">Qualquer liquidez</option>
            {liquidity.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
          <select className="select" value={perf} onChange={(e) => setPerf(e.target.value)} aria-label="Desempenho">
            <option value="">Qualquer desempenho</option>
            <option value="up">Em alta</option>
            <option value="down">Em queda</option>
            <option value="up2">Alta ≥ 2%</option>
            <option value="down2">Queda ≥ 2%</option>
          </select>
          {(sector || liq || perf || q) && <button className="btn ghost sm" onClick={reset}>Limpar filtros</button>}
        </div>
        {c.notice && <div className="notice" style={{ marginTop: 4 }}>{c.notice}</div>}
      </div>
      <AssetTable key={cat} assets={filtered} columns={c.columns} defaultSort={c.defaultSort ?? { key: 'vol', dir: -1 }} />
    </Panel>
  );
}

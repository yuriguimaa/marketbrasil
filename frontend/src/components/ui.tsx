import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ALL_ASSETS } from '../data/universe';
import { Link } from 'react-router-dom';
import type { Asset, DataSource, Quote } from '../types';
import { dirClass, pct, price, signed, timeHM } from '../lib/format';
import { useMarket } from '../services/marketData';
import { settingsRepo, useRepo, watchlistRepo } from '../services/storage';
import { Icon } from './Icon';

export const Sparkline = memo(function Sparkline({ data, width = 84, height = 30, up }: { data: number[]; width?: number; height?: number; up?: boolean }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  let min = Infinity, max = -Infinity;
  for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
  const rng = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / rng) * (height - 4)).toFixed(1)}`);
  const isUp = up ?? data[data.length - 1] >= data[0];
  const col = isUp ? 'var(--up)' : 'var(--down)';
  const base = height - 2 - ((data[0] - min) / rng) * (height - 4);
  return (
    <svg width={width} height={height} className="spark" aria-hidden="true">
      <line x1="0" x2={width} y1={base} y2={base} stroke="var(--border)" strokeDasharray="2 3" strokeWidth="1" />
      <polyline points={pts.join(' ')} fill="none" stroke={col} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
});

/**
 * Pisca o valor em verde/vermelho quando a cotação muda (como num terminal de negociação).
 * O `key` remonta o span para reiniciar a animação a cada tick.
 */
export function Flash({ value, children, className = '' }: { value?: number; children: ReactNode; className?: string }) {
  const prev = useRef(value);
  const [tick, setTick] = useState<{ n: number; dir: 'up' | 'down' | '' }>({ n: 0, dir: '' });
  useEffect(() => {
    const p = prev.current;
    if (p != null && value != null && value !== p) setTick((t) => ({ n: t.n + 1, dir: value > p ? 'up' : 'down' }));
    prev.current = value;
  }, [value]);
  return <span key={tick.n} className={'flash ' + (tick.dir ? 'flash-' + tick.dir + ' ' : '') + className}>{children}</span>;
}

export const Change =({ v, box = false, d = 2 }: { v?: number; box?: boolean; d?: number }) => (
  <span className={(box ? 'chg ' : '') + dirClass(v) + ' num'}>{pct(v, d)}</span>
);

export const MarketTag = ({ a }: { a: Asset }) =>
  a.market === 'BR' ? <span className="tag br">BRL</span>
  : a.market === 'US' ? <span className="tag us">USD</span>
  : <span className="tag crypto">◆ USD</span>;

export function SourceTag({ source, delayMin }: { source?: DataSource; delayMin?: number }) {
  const [s] = useRepo(settingsRepo);
  if (!source) return null;
  if (source === 'demo') return s.showDemoBadges ? <span className="tag demo" title="Dados fictícios de demonstração">DEMO</span> : null;
  if (source === 'delayed') return <span className="tag delayed" title="Cotação com atraso">ATRASO {delayMin ?? 15}MIN</span>;
  return <span className="tag live">AO VIVO</span>;
}

/** Ativos com logo disponível (empresas, fundos e criptos). Índices, futuros e taxas usam o selo de texto. */
const LOGO_CLASSES = new Set(['stock', 'fii', 'etf', 'bdr', 'reit', 'crypto']);
const failedLogos = new Set<string>();

export const Logo = memo(function Logo({ a, size }: { a: Asset; size?: number }) {
  const cls = a.market === 'BR' ? 'br' : a.market === 'US' ? 'us' : 'crypto';
  const [failed, setFailed] = useState(() => failedLogos.has(a.symbol));
  const style = size ? { width: size, height: size } : undefined;
  if (LOGO_CLASSES.has(a.cls) && !failed) {
    return (
      <span className={'tk-logo has-img ' + cls} style={style}>
        <img src={`/api/logo?symbol=${a.symbol}`} alt="" loading="lazy" decoding="async" draggable={false}
          onError={() => { failedLogos.add(a.symbol); setFailed(true); }} />
      </span>
    );
  }
  return <span className={'tk-logo ' + cls} style={style}>{a.symbol.replace(/\d+$/, '').slice(0, 3)}</span>;
});

export const TickerCell = ({ a, q }: { a: Asset; q?: Quote }) => (
  <div className="tk">
    <Logo a={a} />
    <div style={{ minWidth: 0 }}>
      <b style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{a.symbol}
        {q && q.source !== 'demo' && <span className={'dot ' + (q.source === 'live' ? 'on' : 'warn')} style={{ width: 5, height: 5, boxShadow: 'none' }}
          title={q.source === 'live' ? `Tempo real · ${q.provider}` : `Atrasado ${q.delayMin ?? 15} min · ${q.provider}`} />}
      </b>
      <span>{a.name}</span>
    </div>
  </div>
);

export function MarketCard({ a, label }: { a: Asset; label?: string }) {
  const q = useMarket((s) => s.quotes[a.symbol]);
  const spark = useMarket((s) => s.sparks[a.symbol]);
  const isRate = a.unit === 'PCT';
  return (
    <Link to={'/ativo/' + a.symbol} className="mcard">
      <div className="t"><span className="lbl">{label ?? a.name}</span><SourceTag source={q?.source} delayMin={q?.delayMin} /></div>
      <div className="p num"><Flash value={q?.price}>{q ? price(q.price, a) : '—'}</Flash></div>
      <div className={'c num ' + dirClass(q?.change)}>
        {isRate ? (q && q.change !== 0 ? signed(q.change) + ' p.p.' : 'estável') : <>{signed(q?.change, a.unit === 'PTS' ? 0 : undefined)} ({pct(q?.changePct)})</>}
      </div>
      <Sparkline data={spark ?? []} width={72} up={isRate ? undefined : (q?.change ?? 0) >= 0} />
    </Link>
  );
}

export function Panel({ title, right, children, foot, bodyClass, flush }: { title?: ReactNode; right?: ReactNode; children: ReactNode; foot?: ReactNode; bodyClass?: string; flush?: boolean }) {
  return (
    <section className="panel">
      {(title || right) && <div className="panel-head">{typeof title === 'string' ? <h2>{title}</h2> : title}<div className="spacer" />{right}</div>}
      <div className={flush ? bodyClass : 'panel-body ' + (bodyClass ?? '')}>{children}</div>
      {foot && <div className="panel-foot">{foot}</div>}
    </section>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: (T | [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button key={v} className={v === value ? 'active' : ''} onClick={() => onChange(v)} role="tab" aria-selected={v === value}>{l}</button>;
      })}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string, number?][]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([v, l, n]) => (
        <button key={v} className={v === value ? 'active' : ''} onClick={() => onChange(v)} role="tab" aria-selected={v === value}>
          {l}{n != null && <span className="count">{n}</span>}
        </button>
      ))}
    </div>
  );
}

export function UpdatedAt() {
  const t = useMarket((s) => s.lastUpdate);
  const backend = useMarket((s) => s.backend);
  const live = useMarket((s) => s.liveCount);
  return (
    <span className="dim" style={{ fontSize: 11.5 }}>
      Atualizado {t ? timeHM(t) : '—'} · {backend === 'online' && live > 0 ? `${live} ativos via API · demais em demonstração` : 'dados de demonstração'}
    </span>
  );
}

export function StarButton({ symbol }: { symbol: string }) {
  const [lists, setLists] = useRepo(watchlistRepo);
  const on = lists.some((l) => l.symbols.includes(symbol));
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setLists((ls) => {
      if (on) return ls.map((l) => ({ ...l, symbols: l.symbols.filter((s) => s !== symbol) }));
      if (!ls.length) return [{ id: 'principal', name: 'Principal', symbols: [symbol] }];
      return ls.map((l, i) => (i === 0 ? { ...l, symbols: [...l.symbols, symbol] } : l));
    });
  };
  return (
    <button className={'icon-btn' + (on ? ' on' : '')} onClick={toggle} title={on ? 'Remover da watchlist' : 'Adicionar à watchlist'} aria-label="Watchlist">
      <Icon name="star" size={14} fill={on} />
    </button>
  );
}

export function DemoNotice() {
  const backend = useMarket((s) => s.backend);
  const live = useMarket((s) => s.liveCount);
  const quotes = useMarket((s) => s.quotes);
  if (backend === 'online' && live > 0) {
    // futuros da B3 não têm fonte gratuita: o aviso deles fica só na aba Futuros
    const demo = ALL_ASSETS.filter((a) => a.cls !== 'future' && quotes[a.symbol]?.source === 'demo');
    if (!demo.length) return null;
    return (
      <div className="notice">
        <b>Dados mistos</b>
        <span>{demo.length === 1 ? '1 ativo está' : demo.length + ' ativos estão'} sem cotação real no momento e {demo.length === 1 ? 'exibe' : 'exibem'} dados fictícios marcados como DEMO ({demo.slice(0, 6).map((a) => a.symbol).join(', ')}{demo.length > 6 ? '…' : ''}). Os demais são cotações reais.</span>
      </div>
    );
  }
  return (
    <div className="notice">
      <b>Modo demonstração</b>
      <span>Cotações, históricos e indicadores exibidos são fictícios. Inicie o backend (<code>npm run dev:api</code>) e configure as chaves das APIs para dados reais.</span>
    </div>
  );
}

export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-head"><h3>{title}</h3><div className="spacer" /><button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button></div>
        <div className="panel-body">{children}</div>
        {foot && <div className="panel-foot" style={{ justifyContent: 'flex-end' }}>{foot}</div>}
      </div>
    </div>
  );
}

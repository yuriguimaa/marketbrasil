import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { ALL_ASSETS, CLASS_LABEL } from '../data/universe';
import { clockIn, marketSession } from '../lib/marketHours';
import { useMarket } from '../services/marketData';
import { BullLogo, Icon } from './Icon';
import { Change, MarketTag } from './ui';
import { price } from '../lib/format';

const NAV: { group?: string; items: [string, string, string, string?][] }[] = [
  { items: [['/', 'Visão Geral', 'overview']] },
  { group: 'Mercados', items: [
    ['/brasil', 'Mercado Brasileiro', 'br', 'BR'],
    ['/eua', 'Mercado Americano', 'us', 'US'],
    ['/cripto', 'Criptomoedas', 'crypto'],
    ['/etfs', 'ETFs', 'etf'],
  ] },
  { group: 'Ferramentas', items: [
    ['/rankings', 'Rankings', 'ranking'],
    ['/analise', 'Análise de Ativos', 'analysis'],
    ['/noticias', 'Notícias', 'news'],
  ] },
  { group: 'Pessoal', items: [
    ['/watchlist', 'Minha Watchlist', 'star'],
    ['/carteira', 'Minha Carteira', 'wallet'],
    ['/configuracoes', 'Configurações', 'settings'],
    ['/sobre', 'Sobre e termos', 'info'],
  ] },
];

function Sidebar({ onNav }: { onNav: () => void }) {
  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <Link to="/" className="brand" onClick={onNav} aria-label="MarketBrasil — Visão Geral">
        <span className="brand-mark"><BullLogo size={20} /></span>
        <span>Market<span style={{ color: 'var(--up)' }}>Brasil</span></span>
      </Link>
      <nav className="nav">
        {NAV.map((g, i) => (
          <div key={i}>
            {g.group && <div className="nav-group">{g.group}</div>}
            {g.items.map(([to, label, icon, flag]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={onNav} title={label}>
                <Icon name={icon} /><span>{label}</span>{flag && <span className="flag">{flag}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span>Dados com fins informativos. Não constitui recomendação de investimento.</span>
        <nav aria-label="Institucional" className="foot-links">
          <Link to="/sobre#termos" onClick={onNav}>Termos</Link>
          <Link to="/sobre#privacidade" onClick={onNav}>Privacidade</Link>
          <Link to="/sobre#faq" onClick={onNav}>FAQ</Link>
        </nav>
        <span>© {new Date().getFullYear()} MarketBrasil</span>
      </div>
    </aside>
  );
}

function Search() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const quotes = useMarket((s) => s.quotes);

  const results = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return [];
    const tl = t.toLowerCase();
    return ALL_ASSETS
      .map((a) => ({ a, score: a.symbol === t ? 0 : a.symbol.startsWith(t) ? 1 : a.symbol.includes(t) ? 2 : a.name.toLowerCase().includes(tl) ? 3 : 9 }))
      .filter((x) => x.score < 9).sort((x, y) => x.score - y.score).slice(0, 10).map((x) => x.a);
  }, [q]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const go = (s: string) => { nav('/ativo/' + s); setQ(''); setOpen(false); ref.current?.blur(); };

  return (
    <div className="search">
      <span className="ico"><Icon name="search" size={15} /></span>
      <input ref={ref} value={q} placeholder="Buscar ticker ou nome (PETR4, Apple, Bitcoin…)" aria-label="Buscar ativo"
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && results[sel]) go(results[sel].symbol);
          if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
        }} />
      <kbd>Ctrl K</kbd>
      {open && results.length > 0 && (
        <div className="search-results" role="listbox">
          {results.map((a, i) => (
            <button key={a.symbol} className={i === sel ? 'sel' : ''} onMouseDown={() => go(a.symbol)} onMouseEnter={() => setSel(i)}>
              <b>{a.symbol}</b>
              <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name} <span className="dim">· {CLASS_LABEL[a.cls]}</span></span>
              <span className="num">{price(quotes[a.symbol]?.price, a)}</span>
              <span style={{ display: 'flex', gap: 6 }}><Change v={quotes[a.symbol]?.changePct} /><MarketTag a={a} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const br = marketSession('BR', 'stock', now);
  const us = marketSession('US', 'stock', now);
  const backend = useMarket((s) => s.backend);
  const live = useMarket((s) => s.liveCount);
  return (
    <div className="top-right">
      <span className="mkt-status hide-sm" title="Pregão regular B3 (10h–17h)"><span className={'dot ' + (br.isOpen ? 'on' : 'off')} />B3 {br.label.toLowerCase()} · {clockIn('America/Sao_Paulo', now)}</span>
      <span className="mkt-status hide-sm" title="Pregão regular NYSE/Nasdaq (9h30–16h ET)"><span className={'dot ' + (us.isOpen ? 'on' : 'off')} />NYSE {us.label.toLowerCase()} · {clockIn('America/New_York', now)}</span>
      <span className="mkt-status" title={backend === 'online' ? 'Backend conectado' : 'Sem backend: dados de demonstração'}>
        <span className={'dot ' + (backend === 'online' && live > 0 ? 'on' : 'warn')} />
        {backend === 'online' && live > 0 ? 'API' : 'Demo'}
      </span>
    </div>
  );
}

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className={'app' + (navOpen ? ' nav-open' : '')} onKeyDown={(e) => { if (e.key === 'Escape' && navOpen) setNavOpen(false); }}>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Sidebar onNav={() => setNavOpen(false)} />
      <div className="scrim" onClick={() => setNavOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen((v) => !v)} aria-label={navOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={navOpen}><Icon name="menu" /></button>
          <Search />
          <Clock />
        </header>
        <main id="conteudo" tabIndex={-1} className="content page-enter" key={loc.pathname}>
          <ErrorBoundary resetKey={loc.pathname}><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

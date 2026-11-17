import { useMemo, useState } from 'react';
import { ALL_ASSETS, CLASS_LABEL } from '../data/universe';
import type { Asset } from '../types';
import { MarketTag } from './ui';

/** Campo de busca para escolher um ativo (usado em comparação, watchlist e carteira). */
export function AssetPicker({ onPick, exclude = [], placeholder = 'Adicionar ativo…', filter, autoFocus }: {
  onPick: (a: Asset) => void; exclude?: string[]; placeholder?: string; filter?: (a: Asset) => boolean; autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const res = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return ALL_ASSETS.filter((a) => !exclude.includes(a.symbol) && (!filter || filter(a)) && (a.symbol.toLowerCase().includes(t) || a.name.toLowerCase().includes(t)))
      .sort((a, b) => Number(!a.symbol.toLowerCase().startsWith(t)) - Number(!b.symbol.toLowerCase().startsWith(t))).slice(0, 8);
  }, [q, exclude, filter]);
  const pick = (a: Asset) => { onPick(a); setQ(''); setOpen(false); };
  return (
    <div className="search" style={{ maxWidth: 300, flex: 'none', width: '100%' }}>
      <input className="input" style={{ width: '100%', paddingLeft: 10, paddingRight: 10 }} value={q} placeholder={placeholder} autoFocus={autoFocus}
        aria-label={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, res.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && res[sel]) { e.preventDefault(); pick(res[sel]); }
        }} />
      {open && res.length > 0 && (
        <div className="search-results" style={{ top: 34, zIndex: 70 }}>
          {res.map((a, i) => (
            <button key={a.symbol} type="button" className={i === sel ? 'sel' : ''} style={{ gridTemplateColumns: '64px 1fr auto' }} onMouseDown={() => pick(a)}>
              <b>{a.symbol}</b>
              <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name} <span className="dim">· {CLASS_LABEL[a.cls]}</span></span>
              <MarketTag a={a} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

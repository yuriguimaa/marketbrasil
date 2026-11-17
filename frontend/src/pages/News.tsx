import { usePageMeta } from '../lib/pageMeta';
import { useMemo, useState } from 'react';
import { NewsRow, useNews } from '../components/NewsList';
import { Panel, Tabs } from '../components/ui';
import { timeHM } from '../lib/format';
import { BR_INDICES, getAsset } from '../data/universe';
import { MarketCard } from '../components/ui';

export default function News() {
  usePageMeta('Notícias', 'As principais notícias do mercado financeiro brasileiro: Ibovespa, dólar, juros, empresas, FIIs e criptomoedas.');
  const news = useNews();
  const [cat, setCat] = useState('');
  const [src, setSrc] = useState('');
  const [q, setQ] = useState('');
  const items = news?.items ?? [];
  const cats = useMemo(() => Array.from(new Set(items.map((n) => n.category))).sort(), [items]);
  const sources = useMemo(() => Array.from(new Set(items.map((n) => n.source))).sort(), [items]);
  const list = items.filter((n) => (!cat || n.category === cat) && (!src || n.source === src) && (!q || n.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notícias</h1>
          <div className="sub">Principais manchetes do mercado brasileiro · {news ? (news.live ? `atualizado ${timeHM(news.updatedAt)}` : 'modo exemplo') : 'carregando…'}</div>
        </div>
      </div>
      {news && !news.live && (
        <div className="notice"><b>Manchetes de exemplo</b><span>O agregador de notícias roda no backend (feeds RSS de portais financeiros). Inicie <code>npm run dev:api</code> para ver as notícias reais.</span></div>
      )}
      <div className="grid g-main">
        <Panel flush foot={`${list.length} notícias`}>
          <div style={{ padding: '0 14px' }}>
            <Tabs value={cat} options={[['', 'Todas', items.length], ...cats.map((c) => [c, c, items.filter((n) => n.category === c).length] as [string, string, number])]} onChange={setCat} />
            <div className="filters">
              <input className="input" placeholder="Buscar nas manchetes" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} aria-label="Buscar notícias" />
              <select className="select" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Fonte">
                <option value="">Todas as fontes</option>
                {sources.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {list.map((n) => <NewsRow key={n.id} n={n} />)}
          {!list.length && <div className="empty">Nenhuma notícia encontrada.</div>}
        </Panel>
        <div className="stack" style={{ alignContent: 'start' }}>
          <div className="section-label">Mercado agora</div>
          <div className="cards" style={{ gridTemplateColumns: '1fr' }}>
            {[...BR_INDICES.slice(0, 2).map((a) => a.symbol), 'USDBRL', 'SELIC', 'SPX', 'BTC'].map((s) => <MarketCard key={s} a={getAsset(s)!} />)}
          </div>
        </div>
      </div>
    </>
  );
}

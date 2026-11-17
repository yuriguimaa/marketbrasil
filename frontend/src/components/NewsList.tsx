import { useEffect, useState } from 'react';
import type { NewsItem } from '../types';
import { relTime } from '../lib/format';
import { fetchNews } from '../services/news';

type NewsCache = { items: NewsItem[]; live: boolean; updatedAt: number; at: number };
let shared: NewsCache | null = null;
let inflight: Promise<NewsCache> | null = null;

/** Hook com cache compartilhado (evita várias chamadas ao trocar de página). */
export function useNews() {
  const [data, setData] = useState(shared);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (shared && Date.now() - shared.at < 5 * 60_000) { setData(shared); return; }
      const p = (inflight ??= fetchNews().then((r) => (shared = { ...r, at: Date.now() })).finally(() => { inflight = null; }));
      p.then((r) => alive && setData(r));
    };
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return data;
}

export function NewsRow({ n, compact = false }: { n: NewsItem; compact?: boolean }) {
  const inner = (
    <>
      <div className="meta">
        <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{n.source}</span>
        <span>·</span><span>{n.category}</span>
        <span>·</span><span>{relTime(n.publishedAt)}</span>
        {n.demo && <span className="tag demo">EXEMPLO</span>}
      </div>
      <div className="title">{n.title}</div>
      {!compact && n.summary && <div className="sum">{n.summary}</div>}
    </>
  );
  return n.url
    ? <a className="news-item" href={n.url} target="_blank" rel="noopener noreferrer">{inner}</a>
    : <div className="news-item">{inner}</div>;
}

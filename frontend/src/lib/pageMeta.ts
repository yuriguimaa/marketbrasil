import { useEffect } from 'react';

const SITE = 'MarketBrasil';
const DEFAULT_DESC = 'Cotações, gráficos e indicadores do mercado brasileiro (B3), americano e de criptomoedas, com rankings, watchlist, carteira e notícias.';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}

/** Título, descrição, canonical e Open Graph por página (SPA). */
export function usePageMeta(title: string, description = DEFAULT_DESC, opts: { noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title ? `${title} · ${SITE}` : `${SITE} · Mercado Financeiro`;
    document.title = full;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', location.origin + location.pathname);
    setMeta('name', 'twitter:title', full);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'robots', opts.noindex ? 'noindex, follow' : 'index, follow');
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = location.origin + location.pathname;
  }, [title, description, opts.noindex]);
}

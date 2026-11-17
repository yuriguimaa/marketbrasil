import { Link } from 'react-router-dom';
import { BullLogo } from '../components/Icon';
import { usePageMeta } from '../lib/pageMeta';

const LINKS: [string, string][] = [
  ['/', 'Visão Geral'], ['/brasil', 'Mercado Brasileiro'], ['/eua', 'Mercado Americano'],
  ['/cripto', 'Criptomoedas'], ['/rankings', 'Rankings'], ['/noticias', 'Notícias'],
];

export default function NotFound({ message }: { message?: string }) {
  usePageMeta('Página não encontrada', undefined, { noindex: true });
  return (
    <div style={{ maxWidth: 520, margin: '48px auto', display: 'grid', gap: 16, justifyItems: 'start' }}>
      <BullLogo size={44} color="var(--text-3)" />
      <h1 style={{ margin: 0, fontSize: 22 }}>Página não encontrada</h1>
      <p className="muted" style={{ margin: 0 }}>
        {message ?? 'O endereço acessado não existe ou foi movido.'} Use a busca no topo (Ctrl K) para encontrar um ativo, ou siga para uma das seções:
      </p>
      <nav aria-label="Seções" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {LINKS.map(([to, l]) => <Link key={to} to={to} className={'btn' + (to === '/' ? ' primary' : '')}>{l}</Link>)}
      </nav>
    </div>
  );
}

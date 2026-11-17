import type { NewsItem } from '../types';
import { api } from './api';

/**
 * Notícias: o backend agrega feeds RSS de veículos financeiros brasileiros.
 * Sem backend, exibimos manchetes de EXEMPLO (claramente marcadas), sem fatos reais.
 */
const DEMO_TITLES: [string, string, string[]?][] = [
  ['Exemplo: Ibovespa opera em alta com avanço de bancos e commodities', 'Mercado', ['IBOV', 'ITUB4', 'VALE3']],
  ['Exemplo: Dólar recua frente ao real após dados de inflação nos EUA', 'Câmbio', ['USDBRL']],
  ['Exemplo: Copom mantém sinalização sobre trajetória da Selic', 'Economia', ['SELIC', 'CDI']],
  ['Exemplo: Petrobras divulga relatório trimestral de produção', 'Empresas', ['PETR4']],
  ['Exemplo: Vale atualiza projeções de embarque de minério de ferro', 'Empresas', ['VALE3']],
  ['Exemplo: Fundos imobiliários de logística ampliam distribuição de rendimentos', 'FIIs', ['HGLG11', 'BTLG11', 'IFIX']],
  ['Exemplo: Varejistas reagem a dados de vendas no varejo', 'Empresas', ['MGLU3']],
  ['Exemplo: WEG anuncia investimento em nova fábrica', 'Empresas', ['WEGE3']],
  ['Exemplo: Bitcoin oscila com fluxo de ETFs à vista nos EUA', 'Cripto', ['BTC', 'HASH11']],
  ['Exemplo: Wall Street acompanha balanços de big techs', 'Internacional', ['AAPL', 'NVDA', 'MSFT', 'SPX']],
  ['Exemplo: Itaú Unibanco divulga resultado do trimestre', 'Empresas', ['ITUB4']],
  ['Exemplo: Curva de juros futuros (DI) opera estável', 'Juros', ['DI1F27']],
  ['Exemplo: B3 registra volume financeiro acima da média', 'Mercado', ['B3SA3']],
  ['Exemplo: PRIO conclui etapa de campanha de perfuração', 'Empresas', ['PRIO3']],
  ['Exemplo: Banco do Brasil revisa guidance de carteira de crédito', 'Empresas', ['BBAS3']],
  ['Exemplo: Ambev apresenta dados de volume no mercado brasileiro', 'Empresas', ['ABEV3']],
];

export function demoNews(): NewsItem[] {
  const now = Date.now();
  return DEMO_TITLES.map(([title, category, tickers], i) => ({
    id: 'demo-' + i,
    title,
    summary: 'Conteúdo de demonstração. Conecte o backend para receber as manchetes reais dos principais portais financeiros.',
    source: 'Demonstração',
    category,
    publishedAt: now - (i * 47 + 12) * 60_000,
    tickers,
    demo: true,
  }));
}

export async function fetchNews(q?: string): Promise<{ items: NewsItem[]; live: boolean; updatedAt: number }> {
  const r = await api.news(q, 60);
  if (r?.items?.length) return { items: r.items, live: true, updatedAt: r.updatedAt };
  const items = demoNews();
  return { items: q ? items.filter((n) => n.tickers?.includes(q.toUpperCase())) : items, live: false, updatedAt: Date.now() };
}

/** Filtra notícias relacionadas a um ativo por ticker/nome. */
export function relatedTo(items: NewsItem[], symbol: string, name: string) {
  const firstWord = name.split(/\s+/)[0].toLowerCase();
  return items.filter((n) =>
    n.tickers?.includes(symbol) ||
    n.title.toUpperCase().includes(symbol) ||
    (firstWord.length > 3 && n.title.toLowerCase().includes(firstWord)));
}

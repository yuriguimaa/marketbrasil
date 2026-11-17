import { cached, getText } from '../cache.js';

// Agregador de notícias: feeds RSS públicos de portais financeiros brasileiros.
const FEEDS = [
  { source: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
  { source: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' },
  { source: 'E-Investidor', url: 'https://einvestidor.estadao.com.br/feed/' },
  { source: 'Exame Invest', url: 'https://exame.com/invest/feed/' },
  { source: 'Seu Dinheiro', url: 'https://www.seudinheiro.com/feed/' },
];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, e) => ENT[e] ?? m);
const strip = (s) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; };

const NAMES = {
  PETR4: /petrobras/i, VALE3: /\bvale\b/i, ITUB4: /ita[uú]/i, BBAS3: /banco do brasil/i, WEGE3: /\bweg\b/i,
  BBDC4: /bradesco/i, PRIO3: /\bprio\b/i, MGLU3: /magazine luiza|magalu/i, ABEV3: /ambev/i, B3SA3: /\bB3\b/,
  ELET3: /eletrobras/i, EMBR3: /embraer/i, SUZB3: /suzano/i, JBSS3: /\bjbs\b/i, RENT3: /localiza/i,
  IBOV: /ibovespa/i, USDBRL: /d[oó]lar/i, SELIC: /selic|copom/i, BTC: /bitcoin/i, ETH: /ethereum/i,
  AAPL: /apple/i, NVDA: /nvidia/i, MSFT: /microsoft/i, TSLA: /tesla/i, AMZN: /amazon/i, META: /\bmeta\b/i, GOOGL: /google|alphabet/i,
};

const CATS = [
  ['Cripto', /bitcoin|cripto|ethereum|blockchain|solana/i],
  ['FIIs', /\bFII|fundos? imobili|IFIX/i],
  ['Câmbio', /d[oó]lar|c[aâ]mbio|real se/i],
  ['Juros', /selic|copom|juros|tesouro|\bDI\b|renda fixa|cdi/i],
  ['Economia', /infla[cç][aã]o|ipca|pib|fiscal|governo|desemprego|economia|banco central/i],
  ['Internacional', /wall street|nasdaq|s&p|\bfed\b|eua|estados unidos|china|europa/i],
  ['Mercado', /ibovespa|bolsa|a[cç][oõ]es|mercado/i],
  ['Empresas', /lucro|balan[cç]o|resultado|dividendo|JCP|receita|aquisi[cç][aã]o|ipo/i],
];

// Seções fora do tema mercado financeiro
const OFF_TOPIC = /\/(brasil|politica|esportes?|saude|entretenimento|lifestyle|cultura|celebridades)\//i;

function parse(xml, source) {
  const items = xml.split(/<item[\s>]/i).slice(1).map((chunk) => chunk.split(/<\/item>/i)[0]);
  return items.map((it) => {
    const title = strip(tag(it, 'title'));
    const link = strip(tag(it, 'link')) || strip(tag(it, 'guid'));
    let desc = strip(strip(tag(it, 'description')));
    if (/="|data-[a-z-]+=/.test(desc)) desc = desc.split(/\/>|">/).pop().trim();
    desc = desc.replace(/\s*The post .*$|\s*O post .*$/i, '').slice(0, 280);
    const pub = Date.parse(strip(tag(it, 'pubDate'))) || Date.now();
    const text = title + ' ' + desc;
    const tickers = new Set((title.match(/\b[A-Z]{4}\d{1,2}\b/g) ?? []));
    for (const [sym, re] of Object.entries(NAMES)) if (re.test(title)) tickers.add(sym);
    const category = (CATS.find(([, re]) => re.test(text)) ?? ['Geral'])[0];
    return { id: Buffer.from(link || title).toString('base64url').slice(-40), title, summary: desc, url: link.startsWith('http') ? link : undefined, source, category, publishedAt: pub, tickers: [...tickers] };
  }).filter((n) => n.title && !OFF_TOPIC.test(n.url ?? ''));
}

export const news = {
  id: 'rss', name: 'Notícias (RSS)', scope: FEEDS.map((f) => f.source).join(', '),
  enabled: () => true,
  note: 'Feeds públicos; links abrem no site original.',

  async list({ q, limit = 40 } = {}) {
    const all = await cached('news:all', 5 * 60_000, async () => {
      const res = await Promise.allSettled(FEEDS.map((f) => getText(f.url, 10000).then((x) => parse(x, f.source))));
      const items = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      const seen = new Set();
      return items.filter((n) => { const k = n.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => b.publishedAt - a.publishedAt);
    });
    let items = all;
    if (q) {
      const Q = q.toUpperCase();
      items = all.filter((n) => n.tickers.includes(Q) || n.title.toUpperCase().includes(Q));
    }
    return { items: items.slice(0, limit), updatedAt: Date.now() };
  },
};

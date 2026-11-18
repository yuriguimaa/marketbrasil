/**
 * MarketBrasil — serviço de dados (Fastify).
 * Expõe uma API única (/api/*) para o frontend e isola as integrações externas
 * (chaves de API, limites de requisição, cache e normalização de formatos).
 * Fora da Vercel também serve o build do frontend (frontend/dist).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import './config.js';
import { coingecko } from './providers/coingecko.js';
import { bcb } from './providers/bcb.js';
import { fx } from './providers/fx.js';
import { brapi } from './providers/brapi.js';
import { finnhub } from './providers/finnhub.js';
import { news } from './providers/news.js';
import { getLogo } from './providers/logos.js';
import { yahoo, YAHOO_SYMBOLS } from './providers/yahoo.js';
import { B3_INDEX, B3_SYMBOLS, BCB_SERIES, COINGECKO_IDS, US_SYMBOLS } from './symbols.js';
import { PERIODS, type Bar, type Period, type Provider, type Quotes } from './types.js';

// Fontes oficiais primeiro; o Yahoo (não oficial) só completa o que faltar.
// No histórico vale o primeiro provedor que retornar dados.
const PRIMARY: Provider[] = [coingecko, bcb, fx, brapi, finnhub];
const QUOTE_PROVIDERS: Provider[] = [...PRIMARY, yahoo];
const ALL_SYMBOLS = [...new Set([...YAHOO_SYMBOLS, ...B3_SYMBOLS, ...Object.keys(B3_INDEX), ...US_SYMBOLS, ...Object.keys(COINGECKO_IDS), ...Object.keys(BCB_SERIES), 'USDBRL'])];
const SYMBOL_RE = /^[A-Z0-9^.]{1,12}$/;

// ---------- Segurança ----------
/** CSP das páginas HTML: fontes do Google, logos do próprio backend e o widget do TradingView. */
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' https://s3.tradingview.com",
  'frame-src https://*.tradingview.com https://*.tradingview-widget.com',
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
/** SVG/PNG de terceiros (logos) servidos sem permissão para executar nada. */
const LOGO_CSP = "default-src 'none'; style-src 'unsafe-inline'";

/** CORS: por padrão só a própria origem. ALLOWED_ORIGINS=https://a.com,https://b.com libera outras. */
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean));

// ---------- Utilitários ----------
const parseSymbols = (raw?: string) => (raw ?? '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)).slice(0, 300);

/** Corrige OHLC inconsistente, remove tempos repetidos e barras absurdamente fora da mediana local. */
export function cleanBars(bars: Bar[]): Bar[] {
  const seen = new Set<number>();
  const xs = bars.filter((b) => [b.open, b.high, b.low, b.close].every(Number.isFinite) && b.close > 0 && !seen.has(b.time) && seen.add(b.time))
    .sort((a, b) => a.time - b.time)
    .map((b) => ({ ...b, high: Math.max(b.high, b.open, b.close), low: Math.min(b.low, b.open, b.close), volume: Number.isFinite(b.volume) ? b.volume : 0 }));
  if (xs.length < 7) return xs;
  return xs.filter((b, i) => {
    const w = xs.slice(Math.max(0, i - 5), i + 6).map((x) => x.close).sort((a, c) => a - c);
    const r = b.close / w[w.length >> 1];
    return r > 0.25 && r < 4;
  });
}

// ---------- Arquivos do frontend ----------
const DIST = resolve(fileURLToPath(new URL('../../frontend/dist/', import.meta.url)));
/** Rotas do frontend (React Router). Demais caminhos sem arquivo recebem a SPA com status 404 real. */
const SPA_ROUTE = /^\/(?:(?:brasil|eua|cripto|etfs|rankings|analise|watchlist|carteira|noticias|configuracoes|sobre)\/?|ativo\/[A-Za-z0-9^.]{1,12}\/?)?$/;

// ---------- Aplicação ----------
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    // atrás de proxy reverso (nginx, Cloudflare, Vercel…), TRUST_PROXY=1 usa o IP real do cliente
    trustProxy: process.env.TRUST_PROXY === '1',
    logger: process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : false,
    ajv: { customOptions: { coerceTypes: true, removeAdditional: false } },
  });

  // Cabeçalhos de segurança (a CSP vai só no HTML e nas logos, onde faz sentido)
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false, // HSTS fica a cargo do HTTPS na frente (Vercel/nginx)
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
  });
  app.addHook('onSend', async (_req, reply) => { reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'); });

  await app.register(cors, {
    origin: (origin, cb) => cb(null, !!origin && allowedOrigins.has(origin)),
    methods: ['GET', 'HEAD'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  await app.register(compress, { global: true, threshold: 1024, encodings: ['gzip'] });
  // limite por IP para proteger as cotas dos provedores (aplicado só nas rotas de dados)
  await app.register(rateLimit, {
    global: false,
    max: Number(process.env.RATE_LIMIT ?? 240),
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ statusCode: 429, error: 'muitas requisições; tente novamente em 1 minuto' }),
  });

  // Erros padronizados em português: { error: "..." }
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'parâmetro inválido: ' + err.message.replace(/^querystring\/?\s*/, '') });
    if (err.statusCode === 429) return reply.code(429).send({ error: 'muitas requisições; tente novamente em 1 minuto' });
    req.log.error(err);
    if (!process.env.LOG_LEVEL) console.error(req.url, err);
    const api = req.url.startsWith('/api/');
    return reply.code(api ? 502 : 500).send({ error: api ? 'falha ao consultar provedor de dados' : 'erro interno' });
  });

  // ---------- Rotas da API ----------
  await app.register(async (api) => {
    api.addHook('onSend', async (_req, reply) => { if (!reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store'); });
    const limited = { rateLimit: {} };

    // informa ao frontend quais ativos têm histórico/fundamentos reais, para não pedir o que não existe
    api.get('/status', { config: limited }, async () => ({
      ok: true,
      time: Date.now(),
      history: ALL_SYMBOLS.filter((s) => QUOTE_PROVIDERS.some((p) => p.history && p.supports(s))),
      fundamentals: ALL_SYMBOLS.filter((s) => brapi.supports(s) && !(s in B3_INDEX)),
      providers: [...QUOTE_PROVIDERS, news].map((p) => ({ id: p.id, name: p.name, scope: p.scope, enabled: p.enabled(), note: p.note })),
    }));

    api.get<{ Querystring: { symbols: string } }>('/quotes', {
      config: limited,
      schema: { querystring: { type: 'object', required: ['symbols'], properties: { symbols: { type: 'string', minLength: 1, maxLength: 4000 } } } },
    }, async (req, reply) => {
      const symbols = parseSymbols(req.query.symbols);
      if (!symbols.length) return reply.code(400).send({ error: 'informe ao menos um símbolo válido em ?symbols=' });
      const results = await Promise.allSettled(PRIMARY.map((p) => p.quotes(symbols)));
      const quotes: Quotes = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') Object.assign(quotes, r.value);
        else console.warn(`[quotes] ${PRIMARY[i].id}:`, (r.reason as Error)?.message);
      });
      const missing = symbols.filter((s) => !quotes[s] && yahoo.supports(s));
      if (missing.length) {
        try { Object.assign(quotes, await yahoo.quotes(missing)); } catch (e) { console.warn('[quotes] yahoo:', (e as Error).message); }
      }
      return { quotes };
    });

    api.get<{ Querystring: { symbol: string; period: Period } }>('/history', {
      config: limited,
      schema: {
        querystring: {
          type: 'object', required: ['symbol'],
          properties: { symbol: { type: 'string', minLength: 1, maxLength: 12 }, period: { type: 'string', enum: [...PERIODS], default: '1M' } },
        },
      },
    }, async (req, reply) => {
      const [symbol] = parseSymbols(req.query.symbol);
      if (!symbol) return reply.code(400).send({ error: 'símbolo inválido' });
      for (const p of QUOTE_PROVIDERS) {
        if (!p.history || !p.supports(symbol)) continue;
        try {
          const h = await p.history(symbol, req.query.period);
          if (h?.bars) h.bars = cleanBars(h.bars);
          if (h && h.bars.length >= 2) return h;
        } catch (e) { console.warn(`[history] ${p.id} ${symbol}:`, (e as Error).message); }
      }
      return reply.code(404).send({ error: 'histórico indisponível' });
    });

    api.get<{ Querystring: { symbol: string } }>('/fundamentals', {
      config: limited,
      schema: { querystring: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string', minLength: 1, maxLength: 12 } } } },
    }, async (req, reply) => {
      const [symbol] = parseSymbols(req.query.symbol);
      if (!symbol) return reply.code(400).send({ error: 'símbolo inválido' });
      try {
        const f = await brapi.fundamentals(symbol);
        if (f) return f;
      } catch (e) { console.warn('[fundamentals]', (e as Error).message); }
      return reply.code(404).send({ error: 'fundamentos indisponíveis' });
    });

    api.get<{ Querystring: { q?: string; limit: number } }>('/news', {
      config: limited,
      schema: { querystring: { type: 'object', properties: { q: { type: 'string', maxLength: 100 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 40 } } } },
    }, async (req) => news.list({ q: req.query.q?.slice(0, 40) || undefined, limit: req.query.limit }));

    // logos: cache em memória e no navegador (1 dia), fora do limite de requisições
    api.get<{ Querystring: { symbol: string } }>('/logo', {
      schema: { querystring: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string', maxLength: 12 } } } },
    }, async (req, reply) => {
      const [symbol] = parseSymbols(req.query.symbol);
      const logo = symbol ? await getLogo(symbol) : null;
      reply.header('Cache-Control', 'public, max-age=86400');
      if (!logo) return reply.code(404).send('');
      return reply.type(logo.type).header('Content-Security-Policy', LOGO_CSP).send(logo.body);
    });
  }, { prefix: '/api' });

  // ---------- Frontend compilado (servidor próprio; na Vercel o site estático é servido por ela) ----------
  // Na Vercel o site é servido pela própria plataforma: não há frontend/dist dentro da função.
  // O plugin é carregado só quando necessário (algumas versões do Node na Vercel não suportam suas dependências ESM).
  const hasDist = !process.env.VERCEL && existsSync(resolve(DIST, 'index.html'));
  if (hasDist) {
    const { default: fastifyStatic } = await import('@fastify/static');
    await app.register(fastifyStatic, {
      root: DIST,
      cacheControl: false,
      // arquivos com hash no nome são imutáveis; HTML sempre revalida
      setHeaders(res, path) {
        if (path.endsWith('.html')) {
          res.header('Cache-Control', 'no-cache');
          res.header('Content-Security-Policy', APP_CSP);
        } else {
          res.header('Cache-Control', /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
        }
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(405).send({ error: 'método não permitido' });
    const path = req.url.split('?')[0];
    if (path.startsWith('/api/')) return reply.code(404).send({ error: 'rota não encontrada' });
    if (!hasDist) return reply.code(503).type('text/plain; charset=utf-8').send('Frontend não compilado. Rode `npm run build` ou use `npm run dev:web`.');
    // rotas desconhecidas recebem a SPA (que mostra a página 404) com status 404 real, para SEO
    let decoded = path;
    try { decoded = decodeURIComponent(path); } catch { /* mantém */ }
    return reply.code(SPA_ROUTE.test(decoded) ? 200 : 404).sendFile('index.html');
  });

  return app;
}

// ---------- Uso como função serverless (Vercel) ----------
let ready: Promise<FastifyInstance> | null = null;
/** Handler Node (req, res) para a função da Vercel (api/index.js). */
export async function handler(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  ready ??= buildApp().then(async (app) => { await app.ready(); return app; });
  const app = await ready;
  app.server.emit('request', req, res);
}

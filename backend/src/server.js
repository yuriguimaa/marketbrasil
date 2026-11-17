/**
 * MarketBrasil — serviço de dados.
 * Expõe uma API única (/api/*) para o frontend e isola as integrações externas
 * (chaves de API, limites de requisição, cache e normalização de formatos).
 * Em produção também serve o build do frontend (frontend/dist).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { config } from './config.js';
import { coingecko } from './providers/coingecko.js';
import { bcb } from './providers/bcb.js';
import { fx } from './providers/fx.js';
import { brapi } from './providers/brapi.js';
import { finnhub } from './providers/finnhub.js';
import { news } from './providers/news.js';
import { getLogo } from './providers/logos.js';
import { yahoo, YAHOO_SYMBOLS } from './providers/yahoo.js';
import { B3_INDEX, B3_SYMBOLS, BCB_SERIES, COINGECKO_IDS, US_SYMBOLS } from './symbols.js';

// Fontes oficiais primeiro; o Yahoo (não oficial) só completa o que faltar.
// No histórico vale o primeiro provedor que retornar dados.
const PRIMARY = [coingecko, bcb, fx, brapi, finnhub];
const QUOTE_PROVIDERS = [...PRIMARY, yahoo];
const ALL_SYMBOLS = [...YAHOO_SYMBOLS, ...B3_SYMBOLS, ...Object.keys(B3_INDEX), ...US_SYMBOLS, ...Object.keys(COINGECKO_IDS), ...Object.keys(BCB_SERIES), 'USDBRL'];
const PERIODS = new Set(['1D', '1S', '1M', '3M', '6M', '1A', '5A', 'MAX']);
const SYMBOL_RE = /^[A-Z0-9^.]{1,12}$/;

// ---------- Segurança ----------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
// CSP da aplicação: fontes do Google e logos servidas pelo próprio backend.
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' https://s3.tradingview.com",
  // widget de gráfico do TradingView (iframe)
  "frame-src https://*.tradingview.com https://*.tradingview-widget.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** CORS: por padrão só a própria origem. ALLOWED_ORIGINS=https://a.com,https://b.com libera outras. */
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean));

/** Limite simples por IP para proteger as cotas dos provedores (janela de 1 min). */
const RATE = { windowMs: 60_000, max: Number(process.env.RATE_LIMIT ?? 240) };
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > RATE.windowMs) { hits.set(ip, { start: now, n: 1 }); return false; }
  return ++h.n > RATE.max;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (now - h.start > RATE.windowMs) hits.delete(ip); }, 60_000).unref();

// ---------- Respostas ----------
function send(req, res, code, body, headers = {}) {
  const accepts = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const compressible = buf.length > 1024 && /json|html|javascript|css|svg|xml|text/.test(headers['Content-Type'] ?? '');
  const out = accepts && compressible ? gzipSync(buf) : buf;
  res.writeHead(code, { ...SECURITY_HEADERS, ...headers, ...(out !== buf ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}), 'Content-Length': out.length });
  res.end(req.method === 'HEAD' ? undefined : out);
}
const json = (req, res, code, body) => send(req, res, code, JSON.stringify(body), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

const parseSymbols = (raw) => (raw ?? '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)).slice(0, 300);
const clampInt = (v, lo, hi, def) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };

/** Corrige OHLC inconsistente, remove tempos repetidos e barras absurdamente fora da mediana local. */
function cleanBars(bars) {
  const seen = new Set();
  const xs = bars.filter((b) => [b.open, b.high, b.low, b.close].every(Number.isFinite) && b.close > 0 && !seen.has(b.time) && seen.add(b.time))
    .sort((a, b) => a.time - b.time)
    .map((b) => ({ ...b, high: Math.max(b.high, b.open, b.close), low: Math.min(b.low, b.open, b.close), volume: Number.isFinite(b.volume) ? b.volume : 0 }));
  if (xs.length < 7) return xs;
  return xs.filter((b, i) => {
    const w = xs.slice(Math.max(0, i - 5), i + 6).map((x) => x.close).sort((a, c) => a - c);
    const med = w[w.length >> 1];
    const r = b.close / med;
    return r > 0.25 && r < 4;
  });
}

// ---------- Rotas da API ----------
const routes = {
  async '/api/status'() {
    // informa ao frontend quais ativos têm histórico/fundamentos reais, para não pedir o que não existe
    const history = [...new Set(ALL_SYMBOLS)].filter((s) => QUOTE_PROVIDERS.some((p) => p.history && p.supports(s)));
    const fundamentals = ALL_SYMBOLS.filter((s) => brapi.supports(s) && !(s in B3_INDEX));
    return {
      ok: true, time: Date.now(), history, fundamentals,
      providers: [...QUOTE_PROVIDERS, news].map((p) => ({ id: p.id, name: p.name, scope: p.scope, enabled: p.enabled(), note: p.note })),
    };
  },

  async '/api/quotes'(url) {
    const symbols = parseSymbols(url.searchParams.get('symbols'));
    if (!symbols.length) return [400, { error: 'informe ao menos um símbolo válido em ?symbols=' }];
    const results = await Promise.allSettled(PRIMARY.map((p) => p.quotes(symbols)));
    const quotes = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') Object.assign(quotes, r.value);
      else console.warn(`[quotes] ${PRIMARY[i].id}:`, r.reason?.message);
    });
    const missing = symbols.filter((s) => !quotes[s] && yahoo.supports(s));
    if (missing.length) {
      try { Object.assign(quotes, await yahoo.quotes(missing)); } catch (e) { console.warn('[quotes] yahoo:', e.message); }
    }
    return { quotes };
  },

  async '/api/history'(url) {
    const [symbol] = parseSymbols(url.searchParams.get('symbol'));
    const period = url.searchParams.get('period') ?? '1M';
    if (!symbol) return [400, { error: 'símbolo inválido' }];
    if (!PERIODS.has(period)) return [400, { error: 'período inválido' }];
    for (const p of QUOTE_PROVIDERS) {
      if (!p.history || !p.supports(symbol)) continue;
      try {
        const h = await p.history(symbol, period);
        if (h?.bars) h.bars = cleanBars(h.bars);
        if (h?.bars?.length >= 2) return h;
      } catch (e) { console.warn(`[history] ${p.id} ${symbol}:`, e.message); }
    }
    return [404, { error: 'histórico indisponível' }];
  },

  async '/api/fundamentals'(url) {
    const [symbol] = parseSymbols(url.searchParams.get('symbol'));
    if (!symbol) return [400, { error: 'símbolo inválido' }];
    try {
      const f = await brapi.fundamentals(symbol);
      if (f) return f;
    } catch (e) { console.warn('[fundamentals]', e.message); }
    return [404, { error: 'fundamentos indisponíveis' }];
  },

  async '/api/news'(url) {
    const q = (url.searchParams.get('q') ?? '').slice(0, 40) || undefined;
    return news.list({ q, limit: clampInt(url.searchParams.get('limit'), 1, 100, 40) });
  },
};

// ---------- Arquivos estáticos (build do frontend) ----------
const DIST = resolve(fileURLToPath(new URL('../../frontend/dist/', import.meta.url)));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const staticCache = new Map();
/** Rotas do frontend (React Router). Demais caminhos sem arquivo correspondem a 404. */
const SPA_ROUTE = /^\/(?:(?:brasil|eua|cripto|etfs|rankings|analise|watchlist|carteira|noticias|configuracoes|sobre)\/?|ativo\/[A-Za-z0-9^.]{1,12}\/?)?$/;
async function serveStatic(req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { decoded = '/'; }
  let file = resolve(DIST, '.' + decoded);
  // bloqueia path traversal: o arquivo precisa estar dentro de dist/
  if (file !== DIST && !file.startsWith(DIST + sep)) file = resolve(DIST, 'index.html');
  let status = 200;
  try { if (!(await stat(file)).isFile()) throw 0; } catch {
    file = resolve(DIST, 'index.html');
    // rotas desconhecidas recebem a SPA (que mostra a página 404) com status 404 real, para SEO
    if (!SPA_ROUTE.test(decoded)) status = 404;
  }
  try {
    let body = staticCache.get(file);
    if (!body) { body = await readFile(file); if (process.env.NODE_ENV === 'production') staticCache.set(file, body); }
    const isHtml = file.endsWith('.html');
    const hashed = file.includes(sep + 'assets' + sep);
    send(req, res, status, body, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : isHtml ? 'no-cache' : 'public, max-age=3600',
      ...(isHtml ? { 'Content-Security-Policy': APP_CSP } : {}),
    });
  } catch {
    send(req, res, 503, 'Frontend não compilado. Rode `npm run build` ou use `npm run dev:web`.', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

// ---------- Servidor ----------
/** Handler Node (req, res): usado pelo servidor local e pela função serverless da Vercel (api/index.js). */
export function handler(req, res) {
  return handle(req, res).catch((e) => {
    console.error('[server]', e);
    if (!res.headersSent) json(req, res, 500, { error: 'erro interno' });
    else res.end();
  });
}

// Servidor HTTP apenas quando executado diretamente (node backend/src/server.js)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer(handler).listen(config.port, () => {
    console.log(`MarketBrasil API em http://localhost:${config.port}`);
    console.log(`  brapi: ${config.brapiToken ? 'token configurado' : 'sem token'} · finnhub: ${config.finnhubToken ? 'ativo' : 'sem chave'} · yahoo: ${process.env.YAHOO_ENABLED === '0' ? 'desativado' : 'ativo'}`);
  });
}

async function handle(req, res) {
  let url;
  try { url = new URL(req.url ?? '/', 'http://localhost'); } catch { return json(req, res, 400, { error: 'URL inválida' }); }
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(req, res, 405, { error: 'método não permitido' });

  // logos: cache em memória e no navegador (1 dia), fora do limite de requisições
  if (url.pathname === '/api/logo') {
    const [symbol] = parseSymbols(url.searchParams.get('symbol'));
    const logo = symbol ? await getLogo(symbol) : null;
    if (!logo) return send(req, res, 404, '', { 'Cache-Control': 'public, max-age=86400' });
    // SVG de terceiros servido com CSP restrita (sem scripts)
    return send(req, res, 200, logo.body, { 'Content-Type': logo.type, 'Cache-Control': 'public, max-age=86400', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
  }

  if (url.pathname.startsWith('/api/')) {
    // atrás de proxy reverso (nginx, Cloudflare…), TRUST_PROXY=1 usa o IP real do cliente
    const fwd = process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
    const ip = fwd || req.socket.remoteAddress || '?';
    if (rateLimited(ip)) { res.setHeader('Retry-After', '60'); return json(req, res, 429, { error: 'muitas requisições; tente novamente em 1 minuto' }); }
    const handler = routes[url.pathname];
    if (!handler) return json(req, res, 404, { error: 'rota não encontrada' });
    try {
      const out = await handler(url);
      return Array.isArray(out) ? json(req, res, out[0], out[1]) : json(req, res, 200, out);
    } catch (e) {
      console.error(url.pathname, e);
      return json(req, res, 502, { error: 'falha ao consultar provedor de dados' });
    }
  }
  return serveStatic(req, res, url.pathname);
}

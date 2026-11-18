/** Servidor local / próprio: `npm run dev:api` (desenvolvimento) ou `npm start -w backend` (produção). */
import { config } from './config.js';
import { buildApp } from './app.js';

const app = await buildApp();
const host = process.env.HOST ?? '0.0.0.0';
await app.listen({ port: config.port, host });
console.log(`MarketBrasil API (Fastify) em http://localhost:${config.port}`);
console.log(`  brapi: ${config.brapiToken ? 'token configurado' : 'sem token'} · finnhub: ${config.finnhubToken ? 'ativo' : 'sem chave'} · yahoo: ${process.env.YAHOO_ENABLED === '0' ? 'desativado' : 'ativo'}`);

// encerra com elegância (Ctrl+C / reinício do processo)
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { void app.close().then(() => process.exit(0)); });

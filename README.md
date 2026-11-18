# MarketBrasil

Plataforma de acompanhamento dos mercados brasileiro, americano e cripto: cotações, gráficos interativos (TradingView Lightweight Charts), indicadores técnicos e fundamentalistas, rankings, watchlists, carteira e notícias.

Não há cadastro nem login: watchlists, carteira e preferências ficam salvas no navegador.

## Como rodar

Requer Node 20+.

```bash
npm install
npm run dev:api     # serviço de dados (Fastify + TypeScript) em http://localhost:8787
npm run dev:web     # interface em http://localhost:5173
```

### Publicar na Vercel (produção atual: https://marketbrasil.vercel.app)

O backend roda como função serverless (`api/index.js` → `backend/dist/app.js`, compilado de `backend/src` no build) e o frontend como site estático. Rotas, cabeçalhos de segurança e cache estão em `vercel.json`.

```bash
npx vercel login
npx vercel deploy --prod
```

Variáveis do projeto na Vercel (Settings → Environment Variables): `FINNHUB_TOKEN`, `BRAPI_TOKEN` (secretas) e `TRUST_PROXY=1`.
Cadeia de fontes: brapi/Finnhub/CoinGecko/BCB/AwesomeAPI primeiro; o Yahoo Finance completa o que faltar (por exemplo, a AwesomeAPI bloqueia IPs da Vercel e o dólar vem do Yahoo).

### Publicar em servidor próprio

```bash
SITE_URL=https://seu-dominio.com.br npm run build   # compila backend (tsc) e frontend (vite)
NODE_ENV=production npm start
```

O backend (Fastify) serve o `frontend/dist` com gzip, cache, cabeçalhos de segurança (helmet + CSP) e 404 real para rotas inexistentes. Coloque-o atrás de HTTPS (nginx, Cloudflare ou a hospedagem) e use `TRUST_PROXY=1`. Variáveis opcionais: `ALLOWED_ORIGINS`, `RATE_LIMIT` (veja `backend/.env.example`). O relatório da auditoria técnica está em [AUDITORIA.md](AUDITORIA.md).

## Fontes de dados

| Dado | Provedor | Chave |
|---|---|---|
| Criptomoedas (preço, volume, market cap, histórico) | CoinGecko | não precisa |
| Dólar USD/BRL | AwesomeAPI | não precisa |
| Selic e CDI | Banco Central (SGS) | não precisa |
| Notícias do mercado brasileiro | RSS (InfoMoney, Money Times, E-Investidor, Exame, Seu Dinheiro) | não precisa |
| B3 (ações, FIIs, ETFs, BDRs, Ibovespa) | brapi.dev | `BRAPI_TOKEN` (sem token: só PETR4, VALE3, MGLU3, ITUB4) |
| EUA (ações, ETFs, REITs) | Finnhub | `FINNHUB_TOKEN` |

Copie `backend/.env.example` para `backend/.env` e preencha as chaves. Elas ficam só no servidor.

Ativos sem provedor conectado mostram **dados fictícios marcados como DEMO**. Cotações reais vêm marcadas como **AO VIVO** ou **ATRASO 15MIN**, com o horário da última atualização.

## Estrutura

```
frontend/   React + Vite + TypeScript
  src/data/        catálogo de ativos e gerador de demonstração
  src/services/    cliente da API, store de mercado, notícias, persistência (Repo)
  src/lib/         formatação, indicadores (RSI, MACD, MMs, Bollinger, VWAP, S/R), horários de pregão
  src/components/  componentes reutilizáveis (tabelas, gráficos, cards, busca)
  src/pages/       uma página por seção
backend/    Fastify + TypeScript: /api/status, /quotes, /history, /fundamentals, /news, /logo
  src/app.ts       rotas com validação por esquema, helmet, CORS, rate limit, compressão e arquivos estáticos
  src/server.ts    servidor local/próprio (a Vercel usa o handler exportado por app.ts)
  src/types.ts     tipos compartilhados (Quote, Bar, History, Provider…)
  src/providers/   um adaptador por fonte de dados (cache + normalização)
```

Para adicionar login e banco de dados no futuro: troque `localRepo` em `frontend/src/services/storage.ts` por uma implementação remota e use `setAuthToken` em `services/api.ts`.

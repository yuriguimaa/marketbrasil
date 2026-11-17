# Auditoria técnica — MarketBrasil

Data: 17/11/2026 · Escopo: frontend (React + Vite + TypeScript), backend (Node, sem dependências), conteúdo, SEO, segurança, desempenho e acessibilidade.

## 1. Diagnóstico da estrutura original

A arquitetura já separava bem as camadas: frontend, serviço de dados próprio (`/api`) e adaptadores por provedor (`backend/src/providers`). Também havia componentes reutilizáveis (tabelas, gráficos, cards) e persistência isolada atrás de uma interface `Repo`. Os pontos fracos estavam em:

- endurecimento do servidor para produção;
- dependências com vulnerabilidades;
- elementos institucionais e de SEO;
- tratamento de erros;
- acessibilidade por teclado;
- excesso de requisições ao carregar.

## 2. Problemas encontrados e status

| # | Criticidade | Problema | Status |
|---|---|---|---|
| 1 | Crítico | `vite` 5.4 e `react-router-dom` 6.28 com vulnerabilidades altas (open redirect, leitura de arquivos pelo servidor de dev). `npm audit`: 5 vulnerabilidades | Corrigido: Vite 6.4.6, React Router 7.18.5, plugin-react 4.7.0 → **0 vulnerabilidades** |
| 2 | Crítico | Uma exceção não tratada numa requisição podia derrubar o processo do backend | Corrigido: todo o tratamento passa por `handle()` com `catch` e resposta 500 |
| 3 | Alto | Backend sem cabeçalhos de segurança (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | Corrigido |
| 4 | Alto | CORS aberto para qualquer origem (`*`) | Corrigido: só a mesma origem; outras via `ALLOWED_ORIGINS` |
| 5 | Alto | Sem limite de requisições: qualquer cliente podia esgotar as cotas da brapi, do Finnhub e da CoinGecko | Corrigido: 240 req/min por IP (`RATE_LIMIT`), `TRUST_PROXY` para uso atrás de proxy |
| 6 | Alto | Ao abrir o site, ~45 pedidos de histórico simultâneos, ~35 deles com 404 (ativos sem fonte), estourando o limite da CoinGecko (gráficos de BTC falhando) | Corrigido: `/api/status` informa quais ativos têm histórico/fundamentos reais; o frontend só pede esses, em lotes de 3 e sem duplicar pedidos em andamento. Resultado medido: **7 pedidos, 0 erros** |
| 7 | Alto | Cache do backend tentava de novo um provedor com falha a cada requisição | Corrigido: espera de 30 s após falha, servindo o último valor válido |
| 8 | Alto | Sem tratamento de erro na interface: um erro de componente deixava a tela em branco e falhas de gráfico ficavam carregando para sempre | Corrigido: `ErrorBoundary` por página e mensagem com "Tentar novamente" no gráfico |
| 9 | Alto | Formulário da carteira falhava em silêncio: não validava venda maior que a posição e lia "1.234,56" como 1,234 | Corrigido: mensagens claras, venda limitada à posição, data até hoje (fuso local), números no formato brasileiro |
| 10 | Médio | Validação de entrada da API: `limit=abc` retornava lista vazia, símbolos e métodos HTTP não eram validados | Corrigido: símbolos por regex, inteiros com limites, 400/405 com mensagens |
| 11 | Médio | Rotas inexistentes respondiam 200 com texto simples ("soft 404") | Corrigido: página 404 com links e **status HTTP 404 real** no servidor de produção |
| 12 | Médio | SEO: sem meta description, Open Graph, canonical, robots.txt, sitemap, dados estruturados, manifest; título igual em todas as páginas | Corrigido (ver seção 4) |
| 13 | Médio | Faltavam termos de uso, privacidade, aviso legal (CVM) e FAQ, essenciais num site financeiro | Corrigido: página `/sobre` com Sobre, Fontes, Termos, Privacidade/cookies e FAQ, mais links no rodapé e no menu |
| 14 | Médio | Acessibilidade: sem foco visível, linhas de tabela e cabeçalhos de ordenação inacessíveis por teclado, sem "pular para o conteúdo", contraste do texto terciário abaixo de 4,5:1 | Corrigido |
| 15 | Médio | Pacote JavaScript único de 433 KB | Corrigido: carregamento sob demanda por página e bibliotecas separadas (ver seção 5) |
| 16 | Médio | Servidor de produção sem compressão nem política de cache | Corrigido: gzip, `immutable` para `/assets`, `no-cache` para HTML |
| 17 | Baixo | Componentes de mercado exportados de dentro de uma página (`Dashboard`), quebrando o recarregamento do Vite | Corrigido: movidos para `components/MarketWidgets.tsx` |
| 18 | Baixo | Divisão por zero na barra de altas/quedas sem dados; mapa de calor sem rótulo acessível | Corrigido |
| 19 | Baixo | Configuração `startPage` sem uso; botão "Salvar" de watchlist ativo com nome vazio | Removida / desabilitado até preencher |
| 20 | Baixo | Seções da Visão Geral sem títulos `h2` | Corrigido |
| 21 | Baixo | Path traversal no servidor estático | Testado: já bloqueado. Reforçado com verificação explícita de que o arquivo está dentro de `dist/` |

## 3. Elementos que faltavam e foram criados

- `pages/About.tsx` (`/sobre`): sobre, fontes, termos, privacidade/cookies e FAQ.
- `pages/NotFound.tsx`: 404 com atalhos; também usada para ticker inexistente.
- `components/ErrorBoundary.tsx`: recuperação de erros por página.
- `components/MarketWidgets.tsx`: cards, destaques e mapa de calor reutilizáveis.
- `lib/pageMeta.ts`: título, descrição, canonical, Open Graph e robots por página.
- Rodapé institucional, item "Sobre e termos" no menu e logo clicável para a Visão Geral.
- `public/manifest.webmanifest`, `robots.txt` e `sitemap.xml` (gerados no build).

## 4. SEO implementado

- **Títulos e descrições:** cada página tem título e descrição próprios. Nas páginas de ativo, o título é dinâmico (ex.: "PETR4 · Petrobras PN").
- **Hierarquia de títulos:** um `h1` por página e `h2` nas seções.
- **Canonical, Open Graph e Twitter Card:** atualizados a cada página.
- **`noindex`:** aplicado em Watchlist, Carteira, Configurações e 404, que são páginas pessoais ou sem conteúdo indexável.
- **Dados estruturados:** JSON-LD `WebApplication` (FinanceApplication).
- **`sitemap.xml`:** 9 páginas públicas e 26 páginas de ativos, gerado no build com `SITE_URL`.
- **`robots.txt`:** bloqueia `/api/` e as páginas pessoais.
- **URLs:** já eram amigáveis e em português (`/brasil`, `/eua`, `/ativo/PETR4`).

## 5. Desempenho

| Métrica | Antes | Depois |
|---|---|---|
| JS da aplicação na 1ª carga | 433 KB (139 KB gzip) | 69 KB (26 KB gzip) + `react` 59 KB gzip + `charts` 52 KB gzip, cacheáveis por 1 ano |
| Páginas | todas no pacote inicial | cada página de 1 a 12 KB, carregada ao acessar |
| Pedidos de histórico ao abrir | ~60 (40 com erro) | 7 (0 com erro) |
| Compressão no servidor | não | gzip em HTML, JS, CSS, JSON e SVG |
| DOMContentLoaded (local) | — | ~70 ms |

Também já existiam: fontes com `display=swap` e `preconnect`, logos com `loading="lazy"` e cache de 1 dia, e cache de cotações no backend.

## 6. Segurança, resumo

- **Credenciais:** chaves ficam só em `backend/.env`, que está no `.gitignore` e nunca vai ao navegador. Testado: `/api/status`, `/api/quotes` e o servidor de dev não expõem o token.
- **XSS:** o React escapa o texto. Links de notícias só são aceitos com `http(s)`. SVGs de logos são servidos com CSP `default-src 'none'`. A aplicação tem CSP `script-src 'self'`.
- **SQL injection:** não se aplica, pois não há banco de dados. Os parâmetros da API passam por lista branca e regex.
- **Sessões e permissões:** não se aplicam, porque o site funciona sem conta, por decisão do produto. O ponto de extensão (`setAuthToken`, interface `Repo`) continua pronto.
- **HTTPS:** deve ser feito no proxy ou hospedagem (nginx, Cloudflare, Render…). O app já envia `Cross-Origin-Opener-Policy` e bloqueia iframes.

## 7. Testes realizados

| Teste | Resultado |
|---|---|
| `tsc --noEmit` (tipagem estrita) | ✅ sem erros |
| `npm run build` | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades |
| 17 rotas abertas em sequência no build de produção (título, `h1`, erros) | ✅ todas renderizam; CSP sem violações |
| Status HTTP: `/`, `/brasil`, `/ativo/PETR4`, `/sobre` → 200; `/nao-existe`, `/ativo/XX/YY` → 404; robots, sitemap, manifest → 200 | ✅ |
| Cabeçalhos de segurança e gzip | ✅ |
| Path traversal (`../`, `%2f`, `%5c`) no servidor de produção e no de dev | ✅ não expõe arquivos |
| Validação da API (símbolo inválido, período inválido, `limit=abc`, POST, rota inexistente) | ✅ 400/405/404 com mensagem |
| CORS com origem estranha | ✅ sem `Access-Control-Allow-Origin` |
| Limite de requisições (250 pedidos seguidos) | ✅ 429 após o teto |
| Formulário da carteira: sem ativo, venda sem posição, quantidade inválida | ✅ mensagens corretas |
| Teclado: foco e Enter numa linha de tabela abrem o ativo; link "pular para o conteúdo" | ✅ |
| Celular 375 px: rolagem horizontal da página | ✅ nenhuma (tabelas rolam dentro do próprio painel) |
| Requisições com erro ao abrir `/ativo/AAPL` | ✅ 0 |

Não testado: navegadores Safari e Firefox (o ambiente tem apenas Chromium) e Core Web Vitals em rede real. Recomenda-se rodar o Lighthouse após publicar.

## 8. Limitações conhecidas (não resolvidas)

- **SEO de SPA:** o conteúdo é renderizado no navegador. O Google executa JavaScript, mas outras redes e buscadores podem ver só o HTML base. Para SEO máximo, migrar para renderização no servidor (ex.: Vite SSR ou Next.js).
- **Imagem de compartilhamento:** não há uma imagem PNG 1200×630 para Open Graph (só o ícone SVG). É preciso produzir essa arte.
- **Feriados:** os horários de pregão não consideram feriados da B3 e da NYSE.
- **Dados DEMO:** índices americanos e a maior parte da B3 continuam DEMO até que haja token da brapi e um provedor de índices.
- **Formulário de contato:** não foi criado, pois não há e-mail ou canal oficial definido. Criar um formulário que não entrega mensagens seria um botão sem função.
- **Chave do Finnhub:** foi compartilhada em conversa. Recomenda-se gerar uma nova no painel do Finnhub e atualizar o `backend/.env`.

## 9. Recomendações futuras

1. Token da brapi (plano pago para todos os tickers e histórico intradiário) e um provedor de índices americanos.
2. Calendário de feriados no backend (`/api/calendar`) para o status de pregão.
3. Testes automatizados: unitários para `indicators.ts`, `format.ts` e o cálculo da carteira, e E2E com Playwright para as rotas principais.
4. Cache compartilhado (Redis) se houver mais de uma instância do backend.
5. Monitoramento de erros (ex.: Sentry) e logs estruturados.
6. Se houver contas no futuro: implementação remota do `Repo` e autenticação com cookies `HttpOnly`.

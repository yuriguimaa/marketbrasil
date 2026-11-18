import { defineConfig, type Plugin } from 'vite';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

// Páginas públicas indexáveis (watchlist, carteira e configurações são pessoais).
const PUBLIC_ROUTES = ['/', '/brasil', '/eua', '/cripto', '/etfs', '/rankings', '/analise', '/noticias', '/calendario', '/sobre'];
const ASSET_ROUTES = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'WEGE3', 'BBDC4', 'PRIO3', 'MGLU3', 'ABEV3', 'B3SA3', 'IBOV',
  'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'NFLX', 'JPM', 'SPX', 'BTC', 'ETH', 'SOL', 'BNB'].map((s) => '/ativo/' + s);

/** Gera robots.txt e sitemap.xml no build usando o domínio de produção (SITE_URL). */
function seoFiles(): Plugin {
  return {
    name: 'seo-files',
    apply: 'build',
    generateBundle() {
      const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      const site = (process.env.SITE_URL ?? (vercel ? 'https://' + vercel : 'http://localhost:8787')).replace(/\/$/, '');
      if (!process.env.SITE_URL && !vercel) this.warn('SITE_URL não definido: sitemap.xml usará http://localhost:8787. Defina SITE_URL=https://seu-dominio no build de produção.');
      const today = new Date().toISOString().slice(0, 10);
      const urls = [...PUBLIC_ROUTES, ...ASSET_ROUTES].map((p) =>
        `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod><changefreq>${p.startsWith('/ativo') ? 'hourly' : 'daily'}</changefreq></url>`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /watchlist\nDisallow: /carteira\nDisallow: /configuracoes\nDisallow: /entrar\n\nSitemap: ${site}/sitemap.xml\n` });
    },
    // 404.html = cópia da SPA: hospedagens estáticas (Vercel) a servem com status 404 real
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      if (existsSync(resolve(dist, 'index.html'))) copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

// O frontend conversa apenas com o backend (/api). Em desenvolvimento,
// o Vite faz proxy para o servidor de dados em http://localhost:8787.
export default defineConfig({
  plugins: [react(), seoFiles()],
  server: {
    port: 5173,
    // polling evita falhas EBUSY do watcher nativo no Windows
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // separa bibliotecas grandes para melhor cache entre versões
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['lightweight-charts'] },
      },
    },
  },
});

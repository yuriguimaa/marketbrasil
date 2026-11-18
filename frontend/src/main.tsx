import { lazy as reactLazy, StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { Layout } from './components/Layout';
import { startMarketData } from './services/marketData';
import { startSpotlight } from './lib/spotlight';
import { settingsRepo, useRepo } from './services/storage';
import { startAuth } from './services/auth';
import './services/portfolio';
import Dashboard from './pages/Dashboard';

/**
 * Depois de uma nova publicação, abas abertas podem pedir arquivos da versão anterior (já removidos).
 * Nesse caso recarrega a página uma vez para buscar a versão atual.
 */
function lazy<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return reactLazy(() => load().catch((e) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem('mb:chunk-reload') ?? 0); } catch { /* sem storage */ }
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem('mb:chunk-reload', String(Date.now())); } catch { /* sem storage */ }
      window.location.reload();
      return new Promise<never>(() => {});
    }
    throw e;
  }));
}

// Páginas carregadas sob demanda (a Visão Geral entra no pacote inicial).
const BrazilMarket = lazy(() => import('./pages/BrazilMarket'));
const USMarket = lazy(() => import('./pages/USMarket'));
const Crypto = lazy(() => import('./pages/Crypto'));
const ETFs = lazy(() => import('./pages/ETFs'));
const Rankings = lazy(() => import('./pages/Rankings'));
const Analysis = lazy(() => import('./pages/Analysis'));
const AssetPage = lazy(() => import('./pages/AssetPage'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const News = lazy(() => import('./pages/News'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Calendar = lazy(() => import('./pages/Calendar'));
const NotFound = lazy(() => import('./pages/NotFound'));

const page = (el: React.ReactNode) => <Suspense fallback={<div className="page-loading" role="status" aria-label="Carregando página" />}>{el}</Suspense>;

function App() {
  const [s] = useRepo(settingsRepo);
  useEffect(() => { startMarketData(s.refreshSec); }, [s.refreshSec]);
  useEffect(() => { document.documentElement.dataset.density = s.density; }, [s.density]);
  useEffect(() => startSpotlight(), []);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/brasil" element={page(<BrazilMarket />)} />
        <Route path="/eua" element={page(<USMarket />)} />
        <Route path="/cripto" element={page(<Crypto />)} />
        <Route path="/etfs" element={page(<ETFs />)} />
        <Route path="/rankings" element={page(<Rankings />)} />
        <Route path="/analise" element={page(<Analysis />)} />
        <Route path="/ativo/:symbol" element={page(<AssetPage />)} />
        <Route path="/watchlist" element={page(<Watchlist />)} />
        <Route path="/carteira" element={page(<Portfolio />)} />
        <Route path="/noticias" element={page(<News />)} />
        <Route path="/calendario" element={page(<Calendar />)} />
        <Route path="/configuracoes" element={page(<Settings />)} />
        <Route path="/sobre" element={page(<About />)} />
        <Route path="/entrar" element={page(<Login />)} />
        <Route path="*" element={page(<NotFound />)} />
      </Route>
    </Routes>
  );
}

startAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

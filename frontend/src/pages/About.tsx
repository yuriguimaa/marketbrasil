import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Panel } from '../components/ui';
import { usePageMeta } from '../lib/pageMeta';

const FAQ: [string, string][] = [
  ['Preciso criar conta?', 'Não. Watchlists, carteira e preferências ficam salvas apenas neste navegador. Para levar seus dados a outro dispositivo, use Configurações → Exportar dados.'],
  ['As cotações são em tempo real?', 'Depende da fonte. Cada cotação mostra um selo: AO VIVO (tempo real), ATRASO 15MIN (B3 no plano gratuito da brapi) ou DEMO (dados fictícios, quando nenhuma fonte está conectada para aquele ativo).'],
  ['O que significa DEMO?', 'São valores gerados apenas para demonstrar a interface. Não representam o mercado e não devem ser usados em decisões de investimento.'],
  ['Como os indicadores técnicos são calculados?', 'RSI (14), MACD (12, 26, 9), médias móveis, Bandas de Bollinger (20, 2), VWAP e suportes/resistências são calculados no próprio navegador a partir dos candles exibidos.'],
  ['De onde vêm as notícias?', 'De feeds públicos (RSS) de portais financeiros brasileiros. Os links abrem a matéria no site original.'],
  ['Como funciona a rentabilidade da carteira?', 'Pelo método do preço médio: cada compra atualiza o preço médio; cada venda realiza lucro ou prejuízo sobre ele. Posições em dólar são convertidas para reais pela cotação USD/BRL atual.'],
];

export default function About() {
  usePageMeta('Sobre, termos e privacidade', 'Como o MarketBrasil funciona, fontes de dados, termos de uso, política de privacidade e perguntas frequentes.');
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash]);

  return (
    <div className="prose-page">
      <div className="page-head"><div><h1>Sobre o MarketBrasil</h1><div className="sub">Fontes de dados, termos de uso, privacidade e perguntas frequentes</div></div></div>
      <div className="stack">
        <Panel title={<h2 id="sobre">O que é</h2>}>
          <p>O MarketBrasil reúne em um só painel as cotações, gráficos e indicadores dos mercados brasileiro (B3), americano (NYSE e Nasdaq) e de criptomoedas, além de rankings, watchlists, controle de carteira e as principais notícias do mercado brasileiro.</p>
          <p>Os mercados ficam separados por moeda: ativos da B3 em reais (BRL), ativos americanos e criptomoedas em dólares (USD).</p>
        </Panel>

        <Panel title={<h2 id="fontes">Fontes de dados</h2>}>
          <ul>
            <li><b>B3</b> — brapi.dev (cotações com atraso de cerca de 15 minutos).</li>
            <li><b>EUA</b> — Finnhub.</li>
            <li><b>Índices</b> (Ibovespa, IFIX, SMLL, IDIV, S&amp;P 500, Nasdaq 100, Dow Jones, Russell 2000, VIX) — Yahoo Finance. Índices da B3 com atraso de cerca de 15 minutos.</li>
            <li><b>Criptomoedas</b> — CoinGecko.</li>
            <li><b>Dólar comercial</b> — AwesomeAPI.</li>
            <li><b>Selic e CDI</b> — Banco Central do Brasil (SGS).</li>
            <li><b>Notícias</b> — feeds RSS de InfoMoney, Money Times, E-Investidor, Exame e Seu Dinheiro.</li>
            <li><b>Logos</b> — brapi.dev, Financial Modeling Prep e CoinCap. Marcas pertencem a seus respectivos titulares.</li>
          </ul>
          <p>Quando uma fonte não está disponível para um ativo, os valores exibidos são fictícios e marcados como <b>DEMO</b>. Os horários de pregão não consideram feriados.</p>
        </Panel>

        <Panel title={<h2 id="termos">Termos de uso</h2>}>
          <p>O conteúdo do MarketBrasil tem caráter exclusivamente informativo e educacional. Nada aqui constitui recomendação, oferta ou solicitação de compra ou venda de valores mobiliários, nem consultoria de investimentos nos termos da regulamentação da CVM.</p>
          <p>As informações podem conter atrasos, imprecisões ou interrupções das fontes. Antes de investir, consulte fontes oficiais e um profissional certificado. O uso das informações é de responsabilidade de quem as utiliza.</p>
        </Panel>

        <Panel title={<h2 id="privacidade">Privacidade e cookies</h2>}>
          <p>O MarketBrasil não exige cadastro, não usa cookies de rastreamento e não envia seus dados pessoais a terceiros. Watchlists, carteira e preferências ficam no armazenamento local (localStorage) do seu navegador e nunca saem dele.</p>
          <p>Para apagar tudo, use Configurações → Limpar carteira / Limpar watchlists, ou limpe os dados do site no navegador. As fontes de texto são carregadas do Google Fonts.</p>
        </Panel>

        <Panel title={<h2 id="faq">Perguntas frequentes</h2>}>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

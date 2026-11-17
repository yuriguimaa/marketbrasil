import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CLASS_LABEL, getAsset, hasFundamentals } from '../data/universe';
import { PriceChart } from '../components/PriceChart';
import { TradingViewChart, tvSymbol } from '../components/TradingViewChart';
import { NewsRow, useNews } from '../components/NewsList';
import { DemoNotice, Flash, Logo, MarketTag, Panel, Seg, SourceTag, StarButton } from '../components/ui';
import { Icon } from '../components/Icon';
import { loadFundamentals, loadHistory, perf, useMarket } from '../services/marketData';
import { relatedTo } from '../services/news';
import { compact, dirClass, num, pct, price, signed, timeHM, unitLabel } from '../lib/format';
import { supportResistance, technicalSummary } from '../lib/indicators';
import type { Bar, Fundamentals, History } from '../types';
import { usePageMeta } from '../lib/pageMeta';
import NotFound from './NotFound';

const sigClass = (s: string) => (s === 'Compra' ? 'up' : s === 'Venda' ? 'down' : 'muted');

export default function AssetPage() {
  const { symbol = '' } = useParams();
  const a = getAsset(symbol);
  const q = useMarket((s) => (a ? s.quotes[a.symbol] : undefined));
  const [daily, setDaily] = useState<Bar[]>([]);
  const [chartSrc, setChartSrc] = useState<'mb' | 'tv' | null>(null);
  const [chartHist, setChartHist] = useState<History | null>(null);
  useEffect(() => { setChartSrc(null); }, [symbol]);
  const src = chartSrc ?? (a?.cls === 'future' ? 'tv' : 'mb');
  const [fund, setFund] = useState<Fundamentals | null>(null);
  const news = useNews();
  usePageMeta(
    a ? `${a.symbol} · ${a.name}` : 'Ativo não encontrado',
    a ? `Cotação de ${a.symbol} (${a.name}): gráfico, histórico de preços, indicadores técnicos e fundamentalistas e notícias relacionadas.` : undefined,
    { noindex: !a },
  );

  useEffect(() => {
    if (!a) return;
    setFund(null);
    loadHistory(a.symbol, '1A').then((h) => setDaily(h.bars));
    if (hasFundamentals(a)) loadFundamentals(a).then(setFund);
  }, [a?.symbol]); // eslint-disable-line

  const tech = useMemo(() => (daily.length > 30 ? technicalSummary(daily) : null), [daily]);
  const sr = useMemo(() => (daily.length > 30 ? supportResistance(daily.slice(-120)) : null), [daily]);
  const related = useMemo(() => (a && news ? relatedTo(news.items, a.symbol, a.name).slice(0, 6) : []), [news, a]);

  if (!a) return <NotFound message={`O ativo “${symbol.toUpperCase()}” não está na lista acompanhada pelo MarketBrasil.`} />;

  const hist = chartHist?.bars.slice(-15).reverse() ?? [];
  const isRate = a.unit === 'PCT';
  // futuros da B3: sem fonte gratuita própria; cotação e gráfico vêm só do widget do TradingView
  const tvOnly = a.cls === 'future';
  const curr = a.unit === 'BRL' ? 'R$' : a.unit === 'USD' ? 'US$' : unitLabel(a.unit);
  const w52 = daily.length ? { hi: Math.max(...daily.map((b) => b.high)), lo: Math.min(...daily.map((b) => b.low)) } : null;

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <Link to={a.market === 'BR' ? '/brasil' : a.market === 'US' ? '/eua' : '/cripto'} className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="back" size={14} />{a.market === 'BR' ? 'Mercado Brasileiro' : a.market === 'US' ? 'Mercado Americano' : 'Criptomoedas'}
        </Link>
      </div>
      <div className="asset-head">
        <Logo a={a} />
        <div>
          <h1>{a.symbol} <MarketTag a={a} /><span className="tag">{CLASS_LABEL[a.cls]}</span><StarButton symbol={a.symbol} /></h1>
          <div className="muted" style={{ fontSize: 12.5 }}>{a.name} · {a.exchange}{a.sector ? ' · ' + a.sector : ''}</div>
        </div>
        {tvOnly ? (
          <div className="dim" style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, maxWidth: 260 }}>Cotação no gráfico abaixo, fornecida pelo TradingView (B3 com até 15 min de atraso).</div>
        ) : <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="px num"><Flash value={q?.price}>{q ? (isRate ? price(q.price, a) : `${curr} ${price(q.price, a)}`) : '—'}</Flash></div>
          <div className={'chgline num ' + dirClass(q?.change)}>
            {isRate ? signed(q?.change) + ' p.p.' : `${signed(q?.change, a.decimals ?? 2)} (${pct(q?.changePct)})`} <span className="dim" style={{ fontWeight: 400 }}>hoje</span>
          </div>
          <div className="dim" style={{ fontSize: 11, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
            <SourceTag source={q?.source} delayMin={q?.delayMin} /> {q && <>Atualizado {timeHM(q.updatedAt)}{q.provider && q.source !== 'demo' ? ' · ' + q.provider : ''}</>}
          </div>
        </div>}
      </div>
      <DemoNotice />

      {!tvOnly && <div className="stat-strip">
        <div><div className="k">Abertura</div><div className="v num">{price(q?.open, a)}</div></div>
        <div><div className="k">Máxima do dia</div><div className="v num">{price(q?.high, a)}</div></div>
        <div><div className="k">Mínima do dia</div><div className="v num">{price(q?.low, a)}</div></div>
        <div><div className="k">Fech. anterior</div><div className="v num">{price(q?.prevClose, a)}</div></div>
        {!isRate && a.cls !== 'index' && <div><div className="k">Volume financeiro</div><div className="v num">{compact(q?.volumeFin, a.unit)}</div></div>}
        {q?.marketCap ? <div><div className="k">Market cap</div><div className="v num">{compact(q.marketCap, a.unit)}</div></div> : null}
        {w52 && <div><div className="k">Faixa 52 sem.</div><div className="v num">{price(w52.lo, a)} – {price(w52.hi, a)}</div></div>}
        {daily.length > 1 && q && (() => { const v = (q.price / daily[0].close - 1) * 100; return <div><div className="k">12 meses</div><div className={'v num ' + dirClass(v)}>{pct(v)}</div></div>; })()}
      </div>}

      <Panel flush title={tvSymbol(a) && !tvOnly ? <Seg value={src} options={[['mb', 'Gráfico MarketBrasil'], ['tv', 'Gráfico TradingView']]} onChange={setChartSrc} /> : undefined}>
        {src === 'tv'
          ? <TradingViewChart asset={a} />
          : <PriceChart asset={a} full height={420} defaultPeriod={a.cls === 'rate' ? '1A' : '3M'} onHistory={setChartHist} />}
      </Panel>

      {!tvOnly && <>
      <div className="grid g-3" style={{ marginTop: 12 }}>
        <Panel flush title="Indicadores técnicos" right={tech && <span className={'chg ' + (tech.overall === 'Compra' ? 'up' : tech.overall === 'Venda' ? 'down' : 'flat')}>{tech.overall}</span>}
          foot="Calculados sobre candles diários de 12 meses. Não é recomendação.">
          {tech ? (
            <>
              <div style={{ padding: '10px 14px' }}>
                <div className="gauge">
                  <span style={{ flex: tech.buy || 0.001, background: 'var(--up)' }} />
                  <span style={{ flex: tech.neutral || 0.001, background: '#3a4558' }} />
                  <span style={{ flex: tech.sell || 0.001, background: 'var(--down)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 5 }}>
                  <span className="up">Compra {tech.buy}</span><span className="dim">Neutro {tech.neutral}</span><span className="down">Venda {tech.sell}</span>
                </div>
              </div>
              <table className="t"><tbody>
                {tech.signals.map((s) => (
                  <tr key={s.name}><td className="l muted">{s.name}</td><td className="num">{s.value}</td><td className={sigClass(s.signal)} style={{ width: 70 }}>{s.signal}</td></tr>
                ))}
              </tbody></table>
            </>
          ) : <div className="empty">Calculando…</div>}
        </Panel>

        <Panel flush title="Suporte e resistência" foot="Topos e fundos locais (120 pregões) + pivô clássico">
          {sr ? (
            <table className="t"><tbody>
              {sr.resistances.slice().reverse().map((v, i) => <tr key={'r' + i}><td className="l down">Resistência {sr.resistances.length - i}</td><td className="num">{price(v, a)}</td><td className="num dim">{pct(q ? (v / q.price - 1) * 100 : undefined)}</td></tr>)}
              <tr><td className="l">Preço atual</td><td className="num" style={{ fontWeight: 600 }}>{price(q?.price, a)}</td><td /></tr>
              {sr.pivot != null && <tr><td className="l muted">Pivô</td><td className="num">{price(sr.pivot, a)}</td><td className="num dim">{pct(q ? (sr.pivot / q.price - 1) * 100 : undefined)}</td></tr>}
              {sr.supports.map((v, i) => <tr key={'s' + i}><td className="l up">Suporte {i + 1}</td><td className="num">{price(v, a)}</td><td className="num dim">{pct(q ? (v / q.price - 1) * 100 : undefined)}</td></tr>)}
            </tbody></table>
          ) : <div className="empty">Calculando…</div>}
        </Panel>

        {hasFundamentals(a) ? (
          <Panel title={<h2>Indicadores fundamentalistas {fund && <SourceTag source={fund.source} />}</h2>}>
            {fund ? (
              <div className="kv">
                {([
                  ['P/L', num(fund.pl, 1)], ['P/VP', num(fund.pvp, 2)], ['ROE', pct(fund.roe, 1, false)], ['ROIC', pct(fund.roic, 1, false)],
                  ['Margem líquida', pct(fund.margemLiq, 1, false)], ['Dividend Yield', pct(fund.dy, 2, false)],
                  ['Dív. líq./EBITDA', num(fund.divLiqEbitda, 2)], ['EV/EBITDA', num(fund.evEbitda, 1)],
                  ...(fund.taxaAdm != null ? [['Taxa adm.', pct(fund.taxaAdm, 2, false)]] : []),
                ] as [string, string][]).filter(([, v]) => v !== '—').map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v num">{v}</div></div>)}
              </div>
            ) : <div className="empty">Carregando…</div>}
          </Panel>
        ) : (
          <Panel title="Desempenho">
            <div className="kv">
              {([['7 dias', 5], ['30 dias', 21], ['3 meses', 63], ['6 meses', 126], ['12 meses', 252]] as [string, number][]).map(([l, d]) => {
                const v = perf(a, a.cls === 'crypto' ? Math.round(d * 365 / 252) : d);
                return <div key={l}><div className="k">{l}</div><div className={'v num ' + dirClass(v)}>{pct(v)}</div></div>;
              })}
            </div>
          </Panel>
        )}
      </div>

      <div className="grid g-2" style={{ marginTop: 12 }}>
        <Panel flush title="Histórico de preços" right={chartHist && <span className="dim" style={{ fontSize: 11 }}>Período do gráfico: {chartHist.period}</span>}>
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="t">
              <thead><tr><th className="l">{chartHist?.intraday ? 'Horário' : 'Data'}</th><th>Abertura</th><th>Máxima</th><th>Mínima</th><th>Fechamento</th><th>Var.</th>{!isRate && <th>Volume</th>}</tr></thead>
              <tbody>
                {hist.map((b, i) => {
                  const prev = hist[i + 1]?.close ?? b.open;
                  const d = new Date(b.time * 1000);
                  const tz = a.market === 'US' ? 'America/New_York' : 'America/Sao_Paulo';
                  return (
                    <tr key={b.time}>
                      <td className="l muted">{chartHist?.intraday ? d.toLocaleString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                      <td className="num">{price(b.open, a)}</td><td className="num">{price(b.high, a)}</td><td className="num">{price(b.low, a)}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{price(b.close, a)}</td>
                      <td className={'num ' + dirClass(b.close - prev)}>{pct((b.close / prev - 1) * 100)}</td>
                      {!isRate && <td className="num muted">{compact(b.volume)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel flush title={`Notícias relacionadas a ${a.symbol}`} foot={news?.live ? 'Fonte: portais financeiros (RSS)' : 'Manchetes de exemplo'}>
          {related.length ? related.map((n) => <NewsRow key={n.id} n={n} />) : <div className="empty">Nenhuma notícia recente mencionando {a.symbol}.</div>}
        </Panel>
      </div>
      </>}
    </>
  );
}

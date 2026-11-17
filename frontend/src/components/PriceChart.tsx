import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type Time, type DeepPartial, type ChartOptions,
} from 'lightweight-charts';
import type { Asset, Bar, History, Period } from '../types';
import { bollinger, ema, macd, rsi, sma, supportResistance, vwap } from '../lib/indicators';
import { compact, price } from '../lib/format';
import { tzOffsetMin } from '../lib/marketHours';
import { loadHistory, useMarket } from '../services/marketData';
import { Seg, SourceTag } from './ui';

export const PERIODS: Period[] = ['1D', '1S', '1M', '3M', '6M', '1A', '5A', 'MAX'];
type ChartType = 'candle' | 'line' | 'area';
type Ind = 'mm20' | 'mm50' | 'mm200' | 'ema9' | 'bb' | 'vwap' | 'sr' | 'rsi' | 'macd' | 'vol';

const IND_META: [Ind, string, string][] = [
  ['vol', 'Volume', '#3a4558'],
  ['mm20', 'MM20', '#e9b949'],
  ['mm50', 'MM50', '#4c8dff'],
  ['mm200', 'MM200', '#c084fc'],
  ['ema9', 'MME9', '#2dd4bf'],
  ['bb', 'Bollinger', '#7c8aa5'],
  ['vwap', 'VWAP', '#f472b6'],
  ['sr', 'Sup./Res.', '#a0a8b6'],
  ['rsi', 'RSI', '#e9b949'],
  ['macd', 'MACD', '#4c8dff'],
];

export const chartTheme = (height: number): DeepPartial<ChartOptions> => ({
  height,
  layout: { background: { color: 'transparent' }, textColor: '#7d8696', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, attributionLogo: false },
  grid: { vertLines: { color: 'rgba(34,42,55,0.45)' }, horzLines: { color: 'rgba(34,42,55,0.45)' } },
  rightPriceScale: { borderColor: '#222a37' },
  timeScale: { borderColor: '#222a37', rightOffset: 4, fixLeftEdge: true },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#4a5468', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#232b38' },
    horzLine: { color: '#4a5468', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#232b38' },
  },
  localization: { locale: 'pt-BR' },
});

const UP = '#1fbf75', DOWN = '#ef4552';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Converte horário UTC para o fuso do mercado (o eixo do gráfico é exibido "como UTC"). */
const shiftFor = (a: Asset, intraday: boolean) => {
  if (!intraday) return 0;
  const tz = a.market === 'US' ? 'America/New_York' : 'America/Sao_Paulo';
  return tzOffsetMin(tz) * 60;
};

interface Props {
  asset: Asset;
  height?: number;
  defaultPeriod?: Period;
  full?: boolean;
  defaultType?: ChartType;
  onHistory?: (h: History) => void;
}

export function PriceChart({ asset, height = 380, defaultPeriod = '1D', full = false, defaultType, onHistory }: Props) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [type, setType] = useState<ChartType>(defaultType ?? (full ? 'candle' : 'area'));
  const [inds, setInds] = useState<Set<Ind>>(() => new Set<Ind>(full ? ['vol', 'mm20', 'mm50', 'rsi'] : ['vol']));
  const [hist, setHist] = useState<History | null>(null);
  const [legend, setLegend] = useState<Bar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const q = useMarket((s) => s.quotes[asset.symbol]);

  const boxRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const livePx = useRef<number | null>(null);
  const liveHi = useRef<number | null>(null);
  const liveLo = useRef<number | null>(null);
  const liveTime = useRef<Time | null>(null);
  const animRef = useRef(0);
  const revealedBars = useRef<unknown>(null);
  const [pulse, setPulse] = useState<{ n: number; x: number; y: number; dir: 'up' | 'down'; price: number } | null>(null);
  const mainSeries = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | null>(null);

  useEffect(() => { setPeriod(defaultPeriod); }, [asset.symbol]); // eslint-disable-line

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadHistory(asset.symbol, period).then((h) => {
      if (!alive) return;
      setHist(h); setLoading(false); onHistory?.(h);
    }).catch((e: Error) => {
      if (!alive) return;
      setLoading(false); setError(e.message || 'Falha ao carregar o histórico.');
    });
    return () => { alive = false; };
  }, [asset.symbol, period, retry]); // eslint-disable-line

  const bars = useMemo(() => {
    if (!hist) return [];
    const sh = shiftFor(asset, hist.intraday);
    return hist.bars.map((b) => ({ ...b, time: b.time + sh }));
  }, [hist, asset]);

  const showRsi = full && inds.has('rsi');
  const showMacd = full && inds.has('macd');

  // Constrói os gráficos
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !bars.length) return;
    const fmt = (p: number) => price(p, asset);
    const chart = createChart(el, {
      ...chartTheme(height),
      width: el.clientWidth,
      localization: { locale: 'pt-BR', priceFormatter: fmt },
      timeScale: { borderColor: '#222a37', rightOffset: 3, timeVisible: hist?.intraday, secondsVisible: false },
    });
    chartRef.current = chart;
    // reinicia o estado da vela ao vivo e anima a entrada quando chegam dados novos
    livePx.current = null; liveHi.current = null; liveLo.current = null; liveTime.current = null;
    setPulse(null);
    if (revealedBars.current !== bars && !reducedMotion()) {
      el.animate([{ clipPath: 'inset(0 100% 0 0)', opacity: 0.4 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }],
        { duration: 700, easing: 'cubic-bezier(.16,.84,.3,1)' });
    }
    revealedBars.current = bars;
    const up = bars[bars.length - 1].close >= bars[0].open;
    const data = bars.map((b) => ({ ...b, time: b.time as Time }));
    const pf = { type: 'custom' as const, formatter: fmt, minMove: asset.unit === 'PCT' ? 0.01 : 10 ** -(asset.decimals ?? (bars[0].close < 1 ? 4 : 2)) };

    let main: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'>;
    if (type === 'candle') {
      main = chart.addCandlestickSeries({ upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, priceFormat: pf });
      main.setData(data);
    } else if (type === 'line') {
      main = chart.addLineSeries({ color: up ? UP : DOWN, lineWidth: 2, priceFormat: pf, lastValueVisible: true });
      main.setData(data.map((b) => ({ time: b.time, value: b.close })));
    } else {
      const c = up ? UP : DOWN;
      main = chart.addAreaSeries({ lineColor: c, topColor: up ? 'rgba(31,191,117,0.18)' : 'rgba(239,69,82,0.18)', bottomColor: 'rgba(0,0,0,0)', lineWidth: 2, priceFormat: pf });
      main.setData(data.map((b) => ({ time: b.time, value: b.close })));
    }
    mainSeries.current = main;

    if (hist?.intraday && hist.bars.length && q) {
      main.createPriceLine({ price: q.prevClose, color: '#4a5468', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'Fech. ant.' });
    }

    if (inds.has('vol') && bars.some((b) => b.volume > 0)) {
      const v = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      v.setData(bars.map((b) => ({ time: b.time as Time, value: b.volume, color: b.close >= b.open ? 'rgba(31,191,117,0.35)' : 'rgba(239,69,82,0.35)' })));
    }
    const line = (pts: { time: number; value: number }[], color: string, width: 1 | 2 = 1, style = LineStyle.Solid) => {
      const s = chart.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: pf });
      s.setData(pts.map((p) => ({ time: p.time as Time, value: p.value })));
    };
    if (inds.has('mm20')) line(sma(bars, 20), '#e9b949');
    if (inds.has('mm50')) line(sma(bars, 50), '#4c8dff');
    if (inds.has('mm200')) line(sma(bars, 200), '#c084fc');
    if (inds.has('ema9')) line(ema(bars, 9), '#2dd4bf');
    if (inds.has('bb')) {
      const bb = bollinger(bars);
      line(bb.up, '#7c8aa5', 1, LineStyle.Dashed); line(bb.mid, '#56607a', 1, LineStyle.Dotted); line(bb.lo, '#7c8aa5', 1, LineStyle.Dashed);
    }
    if (inds.has('vwap')) line(vwap(bars, !!hist?.intraday), '#f472b6', 2);
    if (inds.has('sr')) {
      const sr = supportResistance(bars);
      sr.resistances.forEach((p) => main.createPriceLine({ price: p, color: 'rgba(239,69,82,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'R' }));
      sr.supports.forEach((p) => main.createPriceLine({ price: p, color: 'rgba(31,191,117,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'S' }));
    }

    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((p) => {
      if (!p.time) { setLegend(null); return; }
      const b = bars.find((x) => x.time === (p.time as number));
      setLegend(b ?? null);
    });

    // Sub-gráficos sincronizados
    const subs: IChartApi[] = [];
    const mkSub = (node: HTMLDivElement | null) => {
      if (!node) return null;
      const c = createChart(node, { ...chartTheme(110), width: node.clientWidth, timeScale: { visible: false, borderColor: '#222a37' }, handleScale: false, handleScroll: false });
      subs.push(c);
      return c;
    };
    const rc = showRsi ? mkSub(rsiRef.current) : null;
    if (rc) {
      const s = rc.addLineSeries({ color: '#e9b949', lineWidth: 1, priceLineVisible: false });
      s.setData(rsi(bars).map((p) => ({ time: p.time as Time, value: p.value })));
      s.createPriceLine({ price: 70, color: 'rgba(239,69,82,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
      s.createPriceLine({ price: 30, color: 'rgba(31,191,117,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
    }
    const mc = showMacd ? mkSub(macdRef.current) : null;
    if (mc) {
      const m = macd(bars);
      const h = mc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      h.setData(m.hist.map((p) => ({ time: p.time as Time, value: p.value, color: p.value >= 0 ? 'rgba(31,191,117,0.5)' : 'rgba(239,69,82,0.5)' })));
      const l1 = mc.addLineSeries({ color: '#4c8dff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      l1.setData(m.macd.map((p) => ({ time: p.time as Time, value: p.value })));
      const l2 = mc.addLineSeries({ color: '#e9b949', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      l2.setData(m.signal.map((p) => ({ time: p.time as Time, value: p.value })));
    }
    const syncRange = (r: any) => { if (r) subs.forEach((c) => c.timeScale().setVisibleLogicalRange(r)); };
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncRange);
    subs.forEach((c) => c.timeScale().fitContent());
    syncRange(chart.timeScale().getVisibleLogicalRange());

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
      subs.forEach((c, i) => { const n = [rsiRef.current, macdRef.current].filter(Boolean)[i]; if (n) c.applyOptions({ width: n.clientWidth }); });
    });
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); subs.forEach((c) => c.remove()); chartRef.current = null; mainSeries.current = null; };
  }, [bars, type, inds, height, showRsi, showMacd]); // eslint-disable-line

  // Atualização em tempo real da última barra, animada: a vela/linha "anda" até o novo preço
  // e um pulso verde/vermelho marca a alta ou a queda no ponto atual.
  useEffect(() => {
    const s = mainSeries.current;
    const chart = chartRef.current;
    if (!s || !chart || !q || !bars.length || !hist) return;
    if (period === '5A' || period === 'MAX') return;
    // não mistura histórico fictício com cotação real (e vice-versa)
    if ((hist.source === 'demo') !== (q.source === 'demo')) return;
    const prev = bars[bars.length - 1];
    // duração de uma vela (menor intervalo entre as últimas barras)
    let span = Infinity;
    for (let i = Math.max(1, bars.length - 6); i < bars.length; i++) span = Math.min(span, bars[i].time - bars[i - 1].time);
    if (!isFinite(span) || span <= 0) span = hist.intraday ? 300 : 86400;
    // cotação mais nova que a última vela: abre uma vela nova em vez de sobrescrever a anterior
    const tq = Math.floor(q.updatedAt / 1000) + shiftFor(asset, hist.intraday);
    const k = Math.floor((tq - prev.time) / span);
    const fresh = k >= 1;
    if (fresh && k > (hist.intraday ? 500 : 7)) return; // cotação muito distante do histórico: não emenda
    const time = (fresh ? prev.time + k * span : prev.time) as Time;
    const open = fresh ? prev.close : prev.open;
    if (liveTime.current !== time) { liveTime.current = time; liveHi.current = null; liveLo.current = null; livePx.current = null; }
    const to = q.price;
    const from = livePx.current ?? prev.close;
    livePx.current = to;
    const paint = (v: number) => {
      liveHi.current = Math.max(liveHi.current ?? (fresh ? open : prev.high), v);
      liveLo.current = Math.min(liveLo.current ?? (fresh ? open : prev.low), v);
      try {
        if (type === 'candle') (s as ISeriesApi<'Candlestick'>).update({ time, open, high: liveHi.current, low: liveLo.current, close: v });
        else (s as ISeriesApi<'Line'>).update({ time, value: v });
      } catch { /* série recriada */ }
    };
    cancelAnimationFrame(animRef.current);
    if (from === to || reducedMotion()) { paint(to); return; }
    const t0 = performance.now(), dur = 520;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      paint(from + (to - from) * e);
      if (k < 1) { animRef.current = requestAnimationFrame(step); return; }
      const x = chart.timeScale().timeToCoordinate(time);
      const y = s.priceToCoordinate(to);
      if (x != null && y != null) setPulse((p) => ({ n: (p?.n ?? 0) + 1, x, y, dir: to > from ? 'up' : 'down', price: to }));
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [q?.price, bars, type, inds]); // eslint-disable-line

  const toggle = (i: Ind) => setInds((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const lb = legend ?? bars[bars.length - 1];

  return (
    <div>
      <div className="chart-toolbar">
        <Seg value={period} options={PERIODS} onChange={setPeriod} />
        <Seg value={type} options={[['candle', 'Velas'], ['line', 'Linha'], ['area', 'Área']]} onChange={setType} />
        <div style={{ flex: 1 }} />
        {hist && <span className="dim" style={{ fontSize: 11 }}>Histórico <SourceTag source={hist.source} /></span>}
      </div>
      {full && (
        <div className="chart-toolbar" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <div className="ind-toggles">
            {IND_META.map(([k, l, c]) => (
              <button key={k} className={'chip' + (inds.has(k) ? ' on' : '')} onClick={() => toggle(k)} aria-pressed={inds.has(k)}>
                <i style={{ background: c }} />{l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="chart-box">
        {lb && (
          <div className="chart-legend num">
            <span>A <b>{price(lb.open, asset)}</b></span>
            <span>M <b>{price(lb.high, asset)}</b></span>
            <span>m <b>{price(lb.low, asset)}</b></span>
            <span>F <b className={lb.close >= lb.open ? 'up' : 'down'}>{price(lb.close, asset)}</b></span>
            {lb.volume > 0 && <span>Vol <b>{compact(lb.volume)}</b></span>}
          </div>
        )}
        <div ref={boxRef} role="img" aria-label={`Gráfico de preços de ${asset.symbol}, período ${period}`} aria-busy={loading}
          style={{ height, opacity: loading ? 0.5 : 1, transition: 'opacity .15s' }} />
        {pulse && (
          <div key={pulse.n} className={'tick-pulse ' + pulse.dir} style={{ left: pulse.x, top: pulse.y }} aria-hidden="true">
            <i /><i />
            <span className="tick-delta num">{pulse.dir === 'up' ? '▲' : '▼'} {price(pulse.price, asset)}</span>
          </div>
        )}
        {error && (
          <div className="chart-error" role="alert">
            <span>Não foi possível carregar o gráfico: {error}</span>
            <button className="btn sm" onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button>
          </div>
        )}
      </div>
      {showRsi && <><div className="subchart-label">RSI (14) <span style={{ color: '#e9b949' }}>—</span></div><div ref={rsiRef} style={{ height: 110 }} /></>}
      {showMacd && <><div className="subchart-label">MACD (12, 26, 9) <span style={{ color: '#4c8dff' }}>MACD</span><span style={{ color: '#e9b949' }}>Sinal</span></div><div ref={macdRef} style={{ height: 110 }} /></>}
    </div>
  );
}

/** Comparação entre ativos: variação % normalizada no período. */
export const COMPARE_COLORS = ['#4c8dff', '#e9b949', '#c084fc', '#2dd4bf', '#f472b6', '#f97316'];

export function CompareChart({ assets, period, height = 360 }: { assets: Asset[]; period: Period; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ a: Asset; pts: { time: number; value: number }[] }[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all(assets.map((a) => loadHistory(a.symbol, period).catch(() => null))).then((hs) => {
      if (!alive) return;
      setData(hs.flatMap((h, i) => {
        if (!h || h.bars.length < 2) return [];
        // normaliza datas para o dia (permite comparar mercados com fusos diferentes)
        const day = !h.intraday;
        const base = h.bars[0]?.close ?? 1;
        return { a: assets[i], pts: h.bars.map((b) => ({ time: day ? Math.floor(b.time / 86400) * 86400 : b.time, value: (b.close / base - 1) * 100 })) };
      }));
    });
    return () => { alive = false; };
  }, [assets, period]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !data.length) return;
    const chart = createChart(el, {
      ...chartTheme(height), width: el.clientWidth,
      localization: { locale: 'pt-BR', priceFormatter: (p: number) => (p > 0 ? '+' : '') + p.toFixed(2) + '%' },
      timeScale: { borderColor: '#222a37', timeVisible: period === '1D' || period === '1S' },
    });
    data.forEach((d, i) => {
      const s = chart.addLineSeries({ color: COMPARE_COLORS[i % COMPARE_COLORS.length], lineWidth: 2, priceLineVisible: false, title: d.a.symbol });
      const seen = new Set<number>();
      s.setData(d.pts.filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true))).map((p) => ({ time: p.time as Time, value: p.value })));
      if (i === 0) s.createPriceLine({ price: 0, color: '#4a5468', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
    });
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height, period]);

  return <div ref={ref} style={{ height }} />;
}

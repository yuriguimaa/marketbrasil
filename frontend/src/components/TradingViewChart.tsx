import { memo, useEffect, useRef } from 'react';
import type { Asset } from '../types';

/**
 * Gráfico avançado do TradingView (widget oficial e gratuito, incorporado via script deles).
 * Os dados ficam dentro do iframe do TradingView: não são lidos pelo MarketBrasil.
 */

const INDEX: Record<string, string> = {
  IBOV: 'BMFBOVESPA:IBOV', IFIX: 'BMFBOVESPA:IFIX', SMLL: 'BMFBOVESPA:SMLL', IDIV: 'BMFBOVESPA:IDIV',
  SPX: 'SP:SPX', NDX: 'NASDAQ:NDX', DJI: 'DJ:DJI', RUT: 'TVC:RUT', VIX: 'TVC:VIX',
  USDBRL: 'FX_IDC:USDBRL',
  // futuros: contrato contínuo (vencimento atual)
  WINZ26: 'BMFBOVESPA:WIN1!', WDOZ26: 'BMFBOVESPA:WDO1!', DI1F27: 'BMFBOVESPA:DI1F2027', BGIZ26: 'BMFBOVESPA:BGI1!',
  // tickers renomeados na B3
  EMBR3: 'BMFBOVESPA:EMBJ3', ELET3: 'BMFBOVESPA:AXIA3',
};

/** Símbolo no TradingView, ou null se o ativo não existe lá (ex.: Selic e CDI). */
export function tvSymbol(a: Asset): string | null {
  if (a.cls === 'rate') return null;
  if (INDEX[a.symbol]) return INDEX[a.symbol];
  if (a.market === 'BR') return 'BMFBOVESPA:' + a.symbol;
  if (a.market === 'CRYPTO') return 'BINANCE:' + a.symbol + 'USDT';
  return a.symbol; // EUA: o TradingView resolve a bolsa (NASDAQ/NYSE/AMEX)
}

export const TradingViewChart = memo(function TradingViewChart({ asset, height = 560 }: { asset: Asset; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const symbol = tvSymbol(asset);

  useEffect(() => {
    const el = ref.current;
    if (!el || !symbol) return;
    el.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.type = 'text/javascript';
    s.async = true;
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: asset.market === 'US' ? 'America/New_York' : 'America/Sao_Paulo',
      theme: 'dark',
      style: '1',
      locale: 'br',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      gridColor: 'rgba(34, 42, 55, 0.45)',
      allow_symbol_change: false,
      hide_side_toolbar: false,
      calendar: false,
      withdateranges: true,
      details: false,
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(s);
    return () => { el.innerHTML = ''; };
  }, [symbol, asset.market]);

  if (!symbol) return <div className="empty">Este ativo não está disponível no TradingView.</div>;
  return (
    <div>
      <div style={{ height, width: '100%' }}>
        <div className="tradingview-widget-container" ref={ref} style={{ height: '100%', width: '100%' }} />
      </div>
      <div className="dim" style={{ fontSize: 11, padding: '6px 14px 10px' }}>
        Gráfico e dados fornecidos pelo{' '}
        <a href={'https://br.tradingview.com/symbols/' + symbol.replace(':', '-').replace('!', '') + '/'} target="_blank" rel="noopener nofollow" className="link">TradingView</a>
        {asset.market === 'BR' ? ' · dados da B3 podem ter atraso' : ''}
      </div>
    </div>
  );
});

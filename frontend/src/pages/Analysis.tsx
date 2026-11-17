import { usePageMeta } from '../lib/pageMeta';
import { useMemo, useState } from 'react';
import { getAsset } from '../data/universe';
import { AssetPicker } from '../components/AssetPicker';
import { AssetTable, C } from '../components/AssetTable';
import { CompareChart, COMPARE_COLORS, PERIODS } from '../components/PriceChart';
import { DemoNotice, Panel, Seg, UpdatedAt } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Period } from '../types';

export default function Analysis() {
  usePageMeta('Análise de Ativos', 'Compare a rentabilidade histórica e os indicadores de até seis ativos do Brasil, dos EUA e de criptomoedas.');
  const [syms, setSyms] = useState(['IBOV', 'SPX', 'PETR4', 'AAPL']);
  const [period, setPeriod] = useState<Period>('1A');
  const assets = useMemo(() => syms.map((s) => getAsset(s)!).filter(Boolean), [syms]);
  const cmpPeriods = PERIODS.filter((p) => p !== '1D' && p !== '1S');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Análise de Ativos</h1>
          <div className="sub">Compare a evolução histórica e os indicadores de até 6 ativos · <UpdatedAt /></div>
        </div>
      </div>
      <DemoNotice />
      <Panel flush
        title={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {assets.map((a, i) => (
            <span key={a.symbol} className="chip on">
              <i style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />{a.symbol}
              <button className="icon-btn" style={{ width: 18, height: 18 }} onClick={() => setSyms((s) => s.filter((x) => x !== a.symbol))} aria-label={'Remover ' + a.symbol}><Icon name="x" size={11} /></button>
            </span>
          ))}
          {syms.length < 6 && <div style={{ width: 220 }}><AssetPicker exclude={syms} placeholder="+ Comparar ativo" onPick={(a) => setSyms((s) => [...s, a.symbol])} /></div>}
        </div>}
        right={<Seg value={period} options={cmpPeriods} onChange={setPeriod} />}
        foot="Rentabilidade acumulada (%) desde o início do período, na moeda de cada ativo. Eixo em datas diárias.">
        {assets.length ? <CompareChart assets={assets} period={period} height={400} /> : <div className="empty">Adicione ativos para comparar.</div>}
      </Panel>
      <div style={{ marginTop: 12 }}>
        <Panel flush title="Comparativo de indicadores">
          <AssetTable assets={assets} columns={[C.ticker(), C.price(), C.change(), C.perf(21, '30 dias'), C.perf(126, '6 meses'), C.perf(252, '12 meses'), C.pl(), C.pvp(), C.roe(), C.dy(), C.mcap()]} />
        </Panel>
      </div>
    </>
  );
}

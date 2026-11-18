import { useState } from 'react';
import { getAsset } from '../data/universe';
import { parseB3, positionId, toNum, type B3File, type Sheet } from '../lib/b3import';
import { money, num } from '../lib/format';
import type { Transaction } from '../services/storage';
import { Modal } from './ui';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MAX_BYTES = 10 * 1024 * 1024;

async function readSheets(file: File): Promise<Sheet[]> {
  const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
  const names = await readSheetNames(file);
  const out: Sheet[] = [];
  for (const name of names) out.push({ name, rows: (await readXlsxFile(file, { sheet: name })) as Sheet['rows'] });
  return out;
}

/** Importa o Extrato de Negociação ou a Posição da B3 para a carteira. */
export function B3Import({ existing, onImport, onClose }: { existing: Transaction[]; onImport: (txs: Transaction[]) => void; onClose: () => void }) {
  const [parsed, setParsed] = useState<B3File | null>(null);
  const [avg, setAvg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const have = new Set(existing.map((t) => t.id));

  const pick = async (file?: File) => {
    if (!file) return;
    setError(undefined); setParsed(null);
    if (!/\.xlsx$/i.test(file.name)) return setError('Envie o arquivo em Excel (.xlsx) baixado na Área do Investidor da B3.');
    if (file.size > MAX_BYTES) return setError('Arquivo grande demais (limite de 10 MB).');
    setBusy(true);
    try {
      const r = parseB3(await readSheets(file), (s) => { const a = getAsset(s); return !!a && a.market === 'BR'; });
      setParsed(r);
      if (r.kind === 'positions') setAvg(Object.fromEntries(r.positions.map((p) => [p.symbol, p.close ? String(+p.close.toFixed(2)).replace('.', ',') : ''])));
    } catch (e) {
      setError(e instanceof Error && /reconhecemos/.test(e.message) ? e.message : 'Não foi possível ler o arquivo. Confira se é a planilha original da B3, em Excel.');
    } finally { setBusy(false); }
  };

  let toAdd: Transaction[] = [];
  let dupes = 0, invalid = '';
  if (parsed?.kind === 'trades') {
    for (const t of parsed.trades) {
      if (have.has(t.id)) { dupes++; continue; }
      toAdd.push({ id: t.id, symbol: t.symbol, side: t.side, qty: t.qty, price: t.price, date: t.date, fees: 0, source: 'b3' });
    }
  } else if (parsed?.kind === 'positions') {
    const d = today();
    for (const p of parsed.positions) {
      const id = positionId(p.symbol, d);
      if (have.has(id)) { dupes++; continue; }
      const px = toNum(avg[p.symbol] ?? '');
      if (!(px > 0)) { invalid = p.symbol; continue; }
      toAdd.push({ id, symbol: p.symbol, side: 'buy', qty: p.qty, price: px, date: d, fees: 0, source: 'b3' });
    }
  }
  const blocked = parsed?.kind === 'positions' && !!invalid;

  return (
    <Modal title="Importar da B3" onClose={onClose}
      foot={<>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!toAdd.length || blocked} onClick={() => onImport(toAdd)}>
          {toAdd.length ? `Importar ${toAdd.length} ${toAdd.length === 1 ? 'operação' : 'operações'}` : 'Importar'}
        </button>
      </>}>
      {!parsed && (
        <div className="b3-steps">
          <p>Na <a href="https://www.investidor.b3.com.br/" target="_blank" rel="noopener noreferrer">Área do Investidor da B3</a>, baixe em Excel um destes arquivos:</p>
          <ul>
            <li><b>Extratos → Negociação</b>: suas compras e vendas. Recomendado, porque calcula o preço médio.</li>
            <li><b>Extratos → Posição</b>: o que você tem hoje. Você informa o preço médio de cada ativo.</li>
          </ul>
          <label className={'dropzone' + (busy ? ' busy' : '')}>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy}
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
            <span>{busy ? 'Lendo planilha…' : 'Escolher arquivo .xlsx'}</span>
          </label>
          <span className="dim" style={{ fontSize: 11.5 }}>O arquivo é lido aqui no seu navegador e não é enviado a nenhum servidor. Só as operações escolhidas são salvas.</span>
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}

      {parsed?.kind === 'trades' && (
        <>
          <p style={{ margin: 0 }}>Extrato de Negociação: <b>{parsed.trades.length}</b> {parsed.trades.length === 1 ? 'operação encontrada' : 'operações encontradas'}
            {parsed.trades.length > 0 && <> de {new Date(parsed.trades[0].date + 'T12:00').toLocaleDateString('pt-BR')} a {new Date(parsed.trades[parsed.trades.length - 1].date + 'T12:00').toLocaleDateString('pt-BR')}</>}.
            {dupes > 0 && <> {dupes} já {dupes === 1 ? 'estava' : 'estavam'} na carteira e não {dupes === 1 ? 'será importada' : 'serão importadas'} de novo.</>}</p>
          {toAdd.length > 0 && (
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table className="t">
                <thead><tr><th className="l">Data</th><th className="l">Tipo</th><th className="l">Ativo</th><th>Qtd.</th><th>Preço</th><th>Total</th></tr></thead>
                <tbody>
                  {toAdd.map((t) => (
                    <tr key={t.id}>
                      <td className="l muted">{new Date(t.date + 'T12:00').toLocaleDateString('pt-BR')}</td>
                      <td className="l">{t.side === 'buy' ? 'Compra' : 'Venda'}</td>
                      <td className="l"><b>{t.symbol}</b></td>
                      <td className="num">{num(t.qty, 0)}</td>
                      <td className="num">{money(t.price)}</td>
                      <td className="num">{money(t.qty * t.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {parsed?.kind === 'positions' && (
        <>
          <p style={{ margin: 0 }}>Posição: <b>{parsed.positions.length}</b> {parsed.positions.length === 1 ? 'ativo' : 'ativos'}. A planilha de posição não traz o preço médio: confira ou corrija o valor de cada ativo. Ele vem preenchido com o preço de fechamento.
            {dupes > 0 && <> {dupes} já {dupes === 1 ? 'foi importado' : 'foram importados'} hoje.</>}</p>
          <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table className="t">
              <thead><tr><th className="l">Ativo</th><th>Qtd.</th><th>Preço médio (R$)</th></tr></thead>
              <tbody>
                {parsed.positions.map((p) => (
                  <tr key={p.symbol}>
                    <td className="l"><b>{p.symbol}</b></td>
                    <td className="num">{num(p.qty, p.qty % 1 ? 4 : 0)}</td>
                    <td><input className="input num" style={{ width: 110, textAlign: 'right' }} inputMode="decimal" aria-label={`Preço médio de ${p.symbol}`}
                      value={avg[p.symbol] ?? ''} onChange={(e) => setAvg({ ...avg, [p.symbol]: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {blocked && <div className="form-error" role="alert">Informe um preço médio maior que zero para {invalid}.</div>}
        </>
      )}

      {parsed && parsed.skipped.length > 0 && (
        <details className="b3-skipped">
          <summary>{parsed.skipped.reduce((s, x) => s + x.count, 0)} {parsed.skipped.length === 1 && parsed.skipped[0].count === 1 ? 'linha ignorada' : 'linhas ignoradas'}</summary>
          <ul>{parsed.skipped.map((s) => <li key={s.symbol + s.reason}><b>{s.symbol}</b>: {s.reason}{s.count > 1 ? ` (${s.count}×)` : ''}</li>)}</ul>
        </details>
      )}
      {parsed && !toAdd.length && !error && <span className="dim">Nada novo para importar neste arquivo.</span>}
      {parsed && <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => { setParsed(null); setError(undefined); }}>Escolher outro arquivo</button>}
    </Modal>
  );
}

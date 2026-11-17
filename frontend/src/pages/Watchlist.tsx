import { usePageMeta } from '../lib/pageMeta';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAsset } from '../data/universe';
import { AssetPicker } from '../components/AssetPicker';
import { C, type Col } from '../components/AssetTable';
import { DemoNotice, MarketTag, Modal, Panel, Tabs, UpdatedAt } from '../components/ui';
import { Icon } from '../components/Icon';
import { fundamentalsSync, useMarket } from '../services/marketData';
import { uid, useRepo, watchlistRepo } from '../services/storage';

type SortMode = 'manual' | 'chg' | 'symbol';

export default function Watchlist() {
  usePageMeta('Minha Watchlist', undefined, { noindex: true });
  const [lists, setLists] = useRepo(watchlistRepo);
  const [activeId, setActiveId] = useState(lists[0]?.id ?? '');
  const [modal, setModal] = useState<null | { mode: 'new' | 'rename'; name: string }>(null);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const quotes = useMarket((s) => s.quotes);
  const sparks = useMarket((s) => s.sparks);
  const nav = useNavigate();
  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  const update = (fn: (syms: string[]) => string[]) =>
    setLists((ls) => ls.map((l) => (l.id === active.id ? { ...l, symbols: fn(l.symbols) } : l)));
  const move = (i: number, d: number) => update((s) => { const n = s.slice(); const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const saveModal = () => {
    if (!modal?.name.trim()) return;
    if (modal.mode === 'new') {
      const id = uid();
      setLists((ls) => [...ls, { id, name: modal.name.trim(), symbols: [] }]);
      setActiveId(id);
    } else setLists((ls) => ls.map((l) => (l.id === active.id ? { ...l, name: modal.name.trim() } : l)));
    setModal(null);
  };
  const remove = () => {
    if (!confirm(`Excluir a lista “${active.name}”?`)) return;
    const rest = lists.filter((l) => l.id !== active.id);
    setLists(rest);
    setActiveId(rest[0]?.id ?? '');
  };

  const cols: Col[] = [C.ticker(), C.price(), C.change(), C.changeAbs('Var.'), C.high(), C.low(), C.volume(), C.spark()];
  let syms = active?.symbols ?? [];
  if (sortMode === 'chg') syms = syms.slice().sort((a, b) => (quotes[b]?.changePct ?? 0) - (quotes[a]?.changePct ?? 0));
  if (sortMode === 'symbol') syms = syms.slice().sort();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Minha Watchlist</h1>
          <div className="sub">Listas salvas neste navegador · <UpdatedAt /></div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setModal({ mode: 'new', name: '' })}><Icon name="plus" size={14} />Nova lista</button>
        </div>
      </div>
      <DemoNotice />
      {!lists.length || !active ? (
        <Panel><div className="empty">Nenhuma lista. <button className="btn primary" onClick={() => setModal({ mode: 'new', name: '' })}>Criar lista</button></div></Panel>
      ) : (
        <Panel flush
          foot={<span>{active.symbols.length} ativos · use as setas para organizar a ordem</span>}>
          <div style={{ padding: '0 14px' }}>
            <Tabs value={active.id} options={lists.map((l) => [l.id, l.name, l.symbols.length])} onChange={setActiveId} />
            <div className="filters">
              <AssetPicker exclude={active.symbols} placeholder="Adicionar ativo à lista…" onPick={(a) => update((s) => [...s, a.symbol])} />
              <select className="select" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} aria-label="Ordenação">
                <option value="manual">Ordem manual</option>
                <option value="chg">Maior variação</option>
                <option value="symbol">Ticker (A–Z)</option>
              </select>
              <div style={{ flex: 1 }} />
              <button className="btn ghost sm" onClick={() => setModal({ mode: 'rename', name: active.name })}><Icon name="edit" size={13} />Renomear</button>
              <button className="btn ghost sm danger" onClick={remove}><Icon name="trash" size={13} />Excluir lista</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th className="l" style={{ width: 70 }}>Ordem</th>{cols.map((c) => <th key={c.key} className={(c.left ? 'l ' : '') + (c.className ?? '')}>{c.label}</th>)}<th className="l">Mercado</th><th /></tr></thead>
              <tbody>
                {syms.map((s) => {
                  const a = getAsset(s);
                  if (!a) return null;
                  const i = active.symbols.indexOf(s);
                  const row = { a, q: quotes[s], f: fundamentalsSync(a), spark: sparks[s] };
                  return (
                    <tr key={s} className="click" onClick={() => nav('/ativo/' + s)}>
                      <td className="l" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" disabled={sortMode !== 'manual' || i === 0} onClick={() => move(i, -1)} aria-label="Subir"><Icon name="up" size={13} /></button>
                        <button className="icon-btn" disabled={sortMode !== 'manual' || i === active.symbols.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><Icon name="down" size={13} /></button>
                      </td>
                      {cols.map((c) => <td key={c.key} className={(c.left ? 'l ' : '') + (c.className ?? '')}>{c.render(row)}</td>)}
                      <td className="l"><MarketTag a={a} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" onClick={() => update((x) => x.filter((y) => y !== s))} aria-label={'Remover ' + s} title="Remover"><Icon name="x" size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!syms.length && <div className="empty">Lista vazia. Busque um ativo acima para adicionar.</div>}
          </div>
        </Panel>
      )}
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Nova lista' : 'Renomear lista'} onClose={() => setModal(null)}
          foot={<><button className="btn ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn primary" onClick={saveModal} disabled={!modal.name.trim()}>Salvar</button></>}>
          <label className="field">Nome da lista
            <input className="input" autoFocus value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveModal()} placeholder="Ex.: Small caps, Tech EUA…" />
          </label>
        </Modal>
      )}
    </>
  );
}

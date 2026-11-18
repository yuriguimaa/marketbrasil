import { usePageMeta } from '../lib/pageMeta';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CLASS_LABEL, getAsset, MARKET_LABEL } from '../data/universe';
import { AssetPicker } from '../components/AssetPicker';
import { Change, DemoNotice, Logo, MarketTag, Modal, Panel, Seg, UpdatedAt } from '../components/ui';
import { Icon } from '../components/Icon';
import { useMarket } from '../services/marketData';
import { localPortfolioRepo, uid, useRepo, type Transaction } from '../services/storage';
import { moveLocalToAccount, portfolioRepo, usePortfolioStatus } from '../services/portfolio';
import { authEnabled } from '../services/auth';
import { B3Import } from '../components/B3Import';
import { dirClass, money, num, pct, price } from '../lib/format';
import type { Asset } from '../types';

interface Position { a: Asset; qty: number; avg: number; cost: number; realized: number; price: number; value: number; valueBRL: number; pnl: number; pnlPct: number; dayPnlBRL: number }

const PALETTE = ['#4c8dff', '#e9b949', '#1fbf75', '#c084fc', '#2dd4bf', '#f472b6', '#f97316', '#94a3b8'];

function Donut({ data, size = 150 }: { data: { label: string; value: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribuição">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-2)" strokeWidth="16" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="16"
            strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          acc += len;
          return el;
        })}
      </svg>
      <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 140 }}>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length] }} />
            <span className="muted" style={{ flex: 1 }}>{d.label}</span>
            <span className="num" style={{ fontWeight: 600 }}>{pct(total ? (d.value / total) * 100 : 0, 1, false)}</span>
          </div>
        ))}
        {!data.length && <span className="dim">Sem posições</span>}
      </div>
    </div>
  );
}

// data local (não UTC), para não bloquear operações à noite no Brasil
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Aceita "1.234,56", "1234,56" e "1234.56". */
const parseBR = (s: string) => {
  let v = s.trim();
  if (!v) return NaN;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  return Number(v);
};

export default function Portfolio() {
  usePageMeta('Minha Carteira', undefined, { noindex: true });
  const [txs, setTxs] = useRepo(portfolioRepo);
  const quotes = useMarket((s) => s.quotes);
  const [filter, setFilter] = useState<'ALL' | 'BR' | 'US' | 'CRYPTO'>('ALL');
  const [form, setForm] = useState<null | { a?: Asset; side: 'buy' | 'sell'; qty: string; price: string; date: string; fees: string; error?: string }>(null);
  const usd = quotes.USDBRL?.price ?? 5.4;
  const pf = usePortfolioStatus();
  const [localTxs] = useRepo(localPortfolioRepo);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [moving, setMoving] = useState(false);
  const [hideMove, setHideMove] = useState(() => { try { return sessionStorage.getItem('mb:hide-move') === '1'; } catch { return false; } });
  const showMove = pf.mode === 'cloud' && !pf.loading && localTxs.length > 0 && !hideMove;

  const positions = useMemo(() => {
    const m = new Map<string, { qty: number; cost: number; realized: number }>();
    for (const t of txs.slice().sort((x, y) => x.date.localeCompare(y.date))) {
      const p = m.get(t.symbol) ?? { qty: 0, cost: 0, realized: 0 };
      if (t.side === 'buy') { p.cost += t.qty * t.price + (t.fees ?? 0); p.qty += t.qty; }
      else if (p.qty > 0) {
        const q = Math.min(t.qty, p.qty);
        const avg = p.cost / p.qty;
        p.realized += (t.price - avg) * q - (t.fees ?? 0);
        p.cost -= avg * q; p.qty -= q;
      }
      m.set(t.symbol, p);
    }
    const out: Position[] = [];
    for (const [sym, p] of m) {
      const a = getAsset(sym);
      if (!a || p.qty <= 1e-12) continue;
      const q = quotes[sym];
      const px = q?.price ?? p.cost / p.qty;
      const fx = a.unit === 'USD' ? usd : 1;
      const value = px * p.qty;
      out.push({
        a, qty: p.qty, avg: p.cost / p.qty, cost: p.cost, realized: p.realized, price: px, value, valueBRL: value * fx,
        pnl: value - p.cost, pnlPct: (value / p.cost - 1) * 100, dayPnlBRL: (q?.change ?? 0) * p.qty * fx,
      });
    }
    return out.sort((x, y) => y.valueBRL - x.valueBRL);
  }, [txs, quotes, usd]);

  const realizedBRL = useMemo(() => {
    let r = 0;
    const m = new Map<string, { qty: number; cost: number }>();
    for (const t of txs.slice().sort((x, y) => x.date.localeCompare(y.date))) {
      const p = m.get(t.symbol) ?? { qty: 0, cost: 0 };
      const fx = getAsset(t.symbol)?.unit === 'USD' ? usd : 1;
      if (t.side === 'buy') { p.cost += t.qty * t.price + (t.fees ?? 0); p.qty += t.qty; }
      else if (p.qty > 0) { const q = Math.min(t.qty, p.qty); const avg = p.cost / p.qty; r += ((t.price - avg) * q - (t.fees ?? 0)) * fx; p.cost -= avg * q; p.qty -= q; }
      m.set(t.symbol, p);
    }
    return r;
  }, [txs, usd]);

  const shown = positions.filter((p) => filter === 'ALL' || p.a.market === filter);
  const total = positions.reduce((s, p) => s + p.valueBRL, 0);
  const costBRL = positions.reduce((s, p) => s + p.cost * (p.a.unit === 'USD' ? usd : 1), 0);
  const dayBRL = positions.reduce((s, p) => s + p.dayPnlBRL, 0);
  const group = (key: (p: Position) => string) => {
    const g = new Map<string, number>();
    positions.forEach((p) => g.set(key(p), (g.get(key(p)) ?? 0) + p.valueBRL));
    return [...g].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  const save = () => {
    if (!form) return;
    const fail = (error: string) => setForm({ ...form, error });
    if (!form.a) return fail('Escolha o ativo da operação.');
    const qty = parseBR(form.qty), pr = parseBR(form.price), fees = form.fees.trim() ? parseBR(form.fees) : 0;
    if (!(qty > 0)) return fail('Informe uma quantidade maior que zero.');
    if (!(pr > 0)) return fail('Informe um preço unitário maior que zero.');
    if (!(fees >= 0)) return fail('As taxas não podem ser negativas.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || form.date > today()) return fail('Informe uma data válida, até hoje.');
    if (form.side === 'sell') {
      const held = positions.find((p) => p.a.symbol === form.a!.symbol)?.qty ?? 0;
      if (qty > held + 1e-9) return fail(held > 0 ? `Você tem ${num(held, held % 1 ? 4 : 0)} ${form.a.symbol}. A venda não pode ser maior que a posição.` : `Você não tem posição em ${form.a.symbol} para vender.`);
    }
    const t: Transaction = { id: uid(), symbol: form.a.symbol, side: form.side, qty, price: pr, date: form.date, fees };
    setTxs((x) => [...x, t]);
    setForm(null);
  };
  const openForm = (a?: Asset, side: 'buy' | 'sell' = 'buy') => setForm({ a, side, qty: '', price: a && quotes[a.symbol] ? String(+quotes[a.symbol].price.toFixed(a.unit === 'USD' && quotes[a.symbol].price < 1 ? 4 : 2)) : '', date: today(), fees: '' });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Minha Carteira</h1>
          <div className="sub">
            Valores consolidados em BRL (USD/BRL {num(usd, 4)}) · {pf.mode === 'cloud'
              ? <>salvo na sua conta{pf.saving ? ' (salvando…)' : ''}</>
              : <>salvo neste navegador{authEnabled && <> · <Link to="/entrar">entre para guardar na sua conta</Link></>}</>} · <UpdatedAt />
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setImporting(true)} disabled={pf.loading}>Importar da B3</button>
          <button className="btn primary" onClick={() => openForm()} disabled={pf.loading}><Icon name="plus" size={14} />Registrar operação</button>
        </div>
      </div>
      <DemoNotice />
      {pf.error && <div className="form-error" role="alert" style={{ marginBottom: 12 }}>{pf.error}</div>}
      {notice && <div className="form-ok" role="status" style={{ marginBottom: 12 }}>{notice}</div>}
      {showMove && (
        <div className="move-banner" role="region" aria-label="Carteira deste navegador">
          <span>Há {localTxs.length} {localTxs.length === 1 ? 'operação salva' : 'operações salvas'} neste navegador, de antes do login. Quer levá-las para sua conta?</span>
          <button className="btn primary sm" disabled={moving} onClick={() => {
            setMoving(true);
            moveLocalToAccount()
              .then((n) => setNotice(n ? `${n} ${n === 1 ? 'operação foi levada' : 'operações foram levadas'} para sua conta.` : 'Essas operações já estavam na sua conta.'))
              .catch(() => setNotice('Não foi possível levar as operações agora. Elas continuam salvas neste navegador; tente de novo em instantes.'))
              .finally(() => setMoving(false));
          }}>{moving ? 'Levando…' : 'Levar para minha conta'}</button>
          <button className="btn ghost sm" onClick={() => { setHideMove(true); try { sessionStorage.setItem('mb:hide-move', '1'); } catch { /* sem storage */ } }}>Agora não</button>
        </div>
      )}

      <div className="stat-strip">
        <div><div className="k">Patrimônio total</div><div className="v num" style={{ fontSize: 16 }}>{money(total)}</div></div>
        <div><div className="k">Valor investido</div><div className="v num">{money(costBRL)}</div></div>
        <div><div className="k">Lucro / prejuízo</div><div className={'v num ' + dirClass(total - costBRL)}>{money(total - costBRL)}</div></div>
        <div><div className="k">Rentabilidade</div><div className={'v num ' + dirClass(total - costBRL)}>{pct(costBRL ? (total / costBRL - 1) * 100 : 0)}</div></div>
        <div><div className="k">Resultado do dia</div><div className={'v num ' + dirClass(dayBRL)}>{money(dayBRL)}</div></div>
        <div><div className="k">Lucro realizado</div><div className={'v num ' + dirClass(realizedBRL)}>{money(realizedBRL)}</div></div>
      </div>

      {pf.loading ? (
        <Panel><div className="empty" role="status">Carregando sua carteira…</div></Panel>
      ) : !txs.length ? (
        <Panel>
          <div className="empty" style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
            <span>Nenhuma operação registrada. Importe a planilha da B3 ou cadastre compras e vendas para acompanhar patrimônio, preço médio e rentabilidade.</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn" onClick={() => setImporting(true)}>Importar da B3</button>
              <button className="btn primary" onClick={() => openForm()}><Icon name="plus" size={14} />Registrar primeira operação</button>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid g-2">
            <Panel title="Distribuição por classe de ativo"><Donut data={group((p) => CLASS_LABEL[p.a.cls])} /></Panel>
            <Panel title="Distribuição por mercado"><Donut data={group((p) => MARKET_LABEL[p.a.market])} /></Panel>
          </div>
          <div style={{ marginTop: 12 }}>
            <Panel flush title="Posições" right={<Seg value={filter} options={[['ALL', 'Todos'], ['BR', 'Brasil'], ['US', 'EUA'], ['CRYPTO', '◆ Cripto']]} onChange={setFilter} />}>
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th className="l">Ativo</th><th className="l">Mercado</th><th>Qtd.</th><th>Preço médio</th><th>Cotação</th><th>Dia</th><th>Valor</th><th>Valor (R$)</th><th>Lucro/prej.</th><th>Rentab.</th><th>% carteira</th><th /></tr></thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.a.symbol}>
                        <td className="l"><Link to={'/ativo/' + p.a.symbol} className="tk"><Logo a={p.a} /><div><b>{p.a.symbol}</b><span>{p.a.name}</span></div></Link></td>
                        <td className="l"><MarketTag a={p.a} /></td>
                        <td className="num">{num(p.qty, p.qty % 1 ? 4 : 0)}</td>
                        <td className="num muted">{price(p.avg, p.a)}</td>
                        <td className="num">{price(p.price, p.a)}</td>
                        <td><Change v={quotes[p.a.symbol]?.changePct} /></td>
                        <td className="num">{money(p.value, p.a.unit === 'USD' ? 'USD' : 'BRL')}</td>
                        <td className="num">{money(p.valueBRL)}</td>
                        <td className={'num ' + dirClass(p.pnl)}>{money(p.pnl, p.a.unit === 'USD' ? 'USD' : 'BRL')}</td>
                        <td><Change v={p.pnlPct} box /></td>
                        <td className="num muted">{pct((p.valueBRL / total) * 100, 1, false)}</td>
                        <td className="nowrap">
                          <button className="btn ghost sm" onClick={() => openForm(p.a, 'buy')}>Comprar</button>
                          <button className="btn ghost sm" onClick={() => setForm({ a: p.a, side: 'sell', qty: String(p.qty), price: String(+p.price.toFixed(2)), date: today(), fees: '' })}>Vender</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!shown.length && <div className="empty">Sem posições neste mercado.</div>}
              </div>
            </Panel>
          </div>
          <div style={{ marginTop: 12 }}>
            <Panel flush title="Histórico de operações" right={<span className="dim" style={{ fontSize: 11.5 }}>{txs.length} operações</span>}>
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table className="t">
                  <thead><tr><th className="l">Data</th><th className="l">Tipo</th><th className="l">Ativo</th><th>Qtd.</th><th>Preço</th><th>Taxas</th><th>Total</th><th /></tr></thead>
                  <tbody>
                    {txs.slice().sort((x, y) => y.date.localeCompare(x.date)).map((t) => {
                      const a = getAsset(t.symbol);
                      const cur = a?.unit === 'USD' ? 'USD' : 'BRL';
                      return (
                        <tr key={t.id}>
                          <td className="l muted">{new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="l"><span className={'tag ' + (t.side === 'buy' ? 'live' : '')} style={t.side === 'sell' ? { color: 'var(--down)', borderColor: 'rgba(239,69,82,.3)' } : undefined}>{t.side === 'buy' ? 'COMPRA' : 'VENDA'}</span></td>
                          <td className="l"><b>{t.symbol}</b></td>
                          <td className="num">{num(t.qty, t.qty % 1 ? 4 : 0)}</td>
                          <td className="num">{money(t.price, cur)}</td>
                          <td className="num muted">{money(t.fees ?? 0, cur)}</td>
                          <td className="num">{money(t.qty * t.price, cur)}</td>
                          <td><button className="icon-btn" onClick={() => confirm('Excluir esta operação?') && setTxs((x) => x.filter((y) => y.id !== t.id))} aria-label="Excluir operação"><Icon name="trash" size={13} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}

      {importing && (
        <B3Import existing={txs} onClose={() => setImporting(false)}
          onImport={(add) => {
            setTxs((x) => [...x, ...add]);
            setImporting(false);
            setNotice(`${add.length} ${add.length === 1 ? 'operação importada' : 'operações importadas'} da B3.`);
          }} />
      )}

      {form && (
        <Modal title="Registrar operação" onClose={() => setForm(null)}
          foot={<><button className="btn ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn primary" onClick={save}>Registrar {form.side === 'buy' ? 'compra' : 'venda'}</button></>}>
          <Seg value={form.side} options={[['buy', 'Compra'], ['sell', 'Venda']]} onChange={(side) => setForm({ ...form, side })} />
          <label className="field">Ativo
            {form.a ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ color: 'var(--text)' }}>{form.a.symbol}</b><span>{form.a.name}</span><MarketTag a={form.a} />
                <button className="btn ghost sm" onClick={() => setForm({ ...form, a: undefined })}>Trocar</button>
              </div>
            ) : <AssetPicker autoFocus placeholder="Buscar ativo…" filter={(a) => a.cls !== 'index' && a.cls !== 'rate'} onPick={(a) => setForm({ ...form, a, price: quotes[a.symbol] ? String(+quotes[a.symbol].price.toFixed(2)) : '' })} />}
          </label>
          <div className="grid g-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label className="field">Quantidade<input className="input" inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="100" /></label>
            <label className="field">Preço unitário ({form.a?.unit === 'USD' ? 'US$' : 'R$'})<input className="input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
            <label className="field">Data<input className="input" type="date" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field">Taxas / corretagem<input className="input" inputMode="decimal" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} placeholder="0,00" /></label>
          </div>
          {form.error && <div className="form-error" role="alert">{form.error}</div>}
          <span className="dim" style={{ fontSize: 11.5 }}>Para cadastrar uma posição existente, registre uma compra com seu preço médio.</span>
        </Modal>
      )}
    </>
  );
}

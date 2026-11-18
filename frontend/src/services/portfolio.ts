/**
 * Carteira: sem login fica neste navegador; com login fica na conta (tabela
 * portfolio_transactions no Supabase, protegida por RLS: cada pessoa só lê e
 * altera as próprias linhas). A tela usa o mesmo `Repo` nos dois casos.
 */
import { useSyncExternalStore } from 'react';
import { getAuth, getClient, onAuth } from './auth';
import { localPortfolioRepo, type Repo, type Transaction } from './storage';

const TABLE = 'portfolio_transactions';

interface Row { id: string; symbol: string; side: 'buy' | 'sell'; qty: number | string; price: number | string; fees: number | string; trade_date: string; source: Transaction['source'] }

export interface PortfolioStatus {
  /** 'local' = neste navegador; 'cloud' = na conta */
  mode: 'local' | 'cloud';
  loading: boolean;
  saving: boolean;
  error?: string;
  email?: string;
}

let status: PortfolioStatus = { mode: 'local', loading: false, saving: false };
let cloud: Transaction[] = [];
let userId: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setStatus = (p: Partial<PortfolioStatus>) => { status = { ...status, ...p }; emit(); };

const toRow = (t: Transaction) => ({ id: t.id, symbol: t.symbol, side: t.side, qty: t.qty, price: t.price, fees: t.fees ?? 0, trade_date: t.date, source: t.source ?? 'manual' });
const fromRow = (r: Row): Transaction => ({ id: r.id, symbol: r.symbol, side: r.side, qty: Number(r.qty), price: Number(r.price), fees: Number(r.fees) || 0, date: r.trade_date, source: r.source });
const same = (a: Transaction, b: Transaction) => a.symbol === b.symbol && a.side === b.side && a.qty === b.qty && a.price === b.price && (a.fees ?? 0) === (b.fees ?? 0) && a.date === b.date;

async function load(uid: string) {
  setStatus({ mode: 'cloud', loading: true, error: undefined });
  try {
    const c = await getClient();
    const all: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await c.from(TABLE).select('id,symbol,side,qty,price,fees,trade_date,source').order('trade_date').order('created_at').range(from, from + 999);
      if (error) throw error;
      all.push(...(data as Row[]));
      if (!data || data.length < 1000) break;
    }
    if (userId !== uid) return; // trocou de conta no meio do caminho
    cloud = all.map(fromRow);
    setStatus({ loading: false });
  } catch {
    if (userId === uid) setStatus({ loading: false, error: 'Não foi possível carregar sua carteira. Recarregue a página para tentar de novo.' });
  }
}

/** Envia ao banco a diferença entre a versão anterior e a nova. */
async function push(prev: Transaction[], next: Transaction[]) {
  const before = new Map(prev.map((t) => [t.id, t]));
  const after = new Set(next.map((t) => t.id));
  const upserts = next.filter((t) => !before.has(t.id) || !same(before.get(t.id)!, t)).map(toRow);
  const removed = prev.filter((t) => !after.has(t.id)).map((t) => t.id);
  const c = await getClient();
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await c.from(TABLE).upsert(upserts.slice(i, i + 500), { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  for (let i = 0; i < removed.length; i += 200) {
    const { error } = await c.from(TABLE).delete().in('id', removed.slice(i, i + 200));
    if (error) throw error;
  }
}

function setCloud(next: Transaction[]) {
  const prev = cloud;
  cloud = next;
  pending++;
  setStatus({ saving: true, error: undefined });
  const uid = userId;
  queue = queue.then(() => push(prev, next)).then(
    () => { if (--pending === 0) setStatus({ saving: false }); },
    () => {
      pending--;
      if (userId !== uid) return;
      setStatus({ saving: pending > 0, error: 'A última alteração não foi salva na sua conta. Verifique a conexão e tente de novo.' });
      void load(uid!); // volta ao que está de fato no banco
    },
  );
}

onAuth(() => {
  const u = getAuth().user;
  if ((u?.id ?? null) === userId) return;
  userId = u?.id ?? null;
  cloud = [];
  if (u) { status = { ...status, email: u.email }; void load(u.id); }
  else setStatus({ mode: 'local', loading: false, saving: false, error: undefined, email: undefined });
});
localPortfolioRepo.subscribe(() => { if (status.mode === 'local') emit(); });

export const portfolioRepo: Repo<Transaction[]> = {
  get: () => (status.mode === 'cloud' ? cloud : localPortfolioRepo.get()),
  set: (v) => (status.mode === 'cloud' ? setCloud(v) : localPortfolioRepo.set(v)),
  subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function usePortfolioStatus(): PortfolioStatus { return useSyncExternalStore(portfolioRepo.subscribe, () => status); }

/** Leva as operações salvas neste navegador para a conta e limpa a cópia local. */
export async function moveLocalToAccount(): Promise<number> {
  if (status.mode !== 'cloud' || status.loading) throw new Error('Entre na sua conta primeiro.');
  const local = localPortfolioRepo.get();
  const have = new Set(cloud.map((t) => t.id));
  const add = local.filter((t) => !have.has(t.id)).map((t) => ({ ...t, source: 'local' as const }));
  const c = await getClient();
  for (let i = 0; i < add.length; i += 500) {
    const { error } = await c.from(TABLE).upsert(add.slice(i, i + 500).map(toRow), { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  cloud = [...cloud, ...add];
  localPortfolioRepo.set([]);
  emit();
  return add.length;
}

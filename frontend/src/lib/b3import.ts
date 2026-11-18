/**
 * Leitura das planilhas que o investidor baixa na Área do Investidor da B3:
 *  - Extrato de Negociação: compras e vendas (dá quantidade e preço médio);
 *  - Posição: o que a pessoa tem hoje (não traz preço médio).
 * Tudo acontece no navegador; o arquivo não é enviado a nenhum servidor.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Sheet = { name: string; rows: Cell[][] };

export interface ParsedTrade { symbol: string; side: 'buy' | 'sell'; qty: number; price: number; date: string; id: string }
export interface ParsedPosition { symbol: string; qty: number; close: number }
export interface Skipped { symbol: string; reason: string; count: number }

export type B3File =
  | { kind: 'trades'; trades: ParsedTrade[]; skipped: Skipped[] }
  | { kind: 'positions'; positions: ParsedPosition[]; skipped: Skipped[] };

const norm = (s: Cell) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Aceita número ou texto como "R$ 1.234,56", "1234,56" e "1234.56". */
export function toNum(v: Cell): number {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/R\$|US\$|\s/g, '');
  if (!s || s === '-') return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}

/** Aceita Date, "dd/mm/aaaa", "aaaa-mm-dd" e número de série do Excel. */
export function toISODate(v: Cell): string | null {
  const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  if (v instanceof Date && !isNaN(+v)) return iso(new Date(v.getTime() + 12 * 3600e3)); // meio-dia evita virar o dia por fuso
  if (typeof v === 'number' && v > 20000 && v < 80000) return iso(new Date(Date.UTC(1899, 11, 30) + v * 86400e3));
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Ticker do mercado fracionário (PETR4F) vira o ticker normal (PETR4). */
export function cleanTicker(v: Cell): string {
  const t = String(v ?? '').toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{4}\d{1,2}F$/.test(t) ? t.slice(0, -1) : t;
}

/** Hash curto e estável para que importar o mesmo arquivo duas vezes não duplique operações. */
function hash(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

function findHeader(rows: Cell[][], must: string[]): { at: number; col: (name: string) => number } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(norm);
    if (must.every((m) => h.some((c) => c.includes(m)))) return { at: i, col: (n) => h.findIndex((c) => c.includes(n)) };
  }
  return null;
}

function addSkip(list: Skipped[], symbol: string, reason: string) {
  const s = list.find((x) => x.symbol === symbol && x.reason === reason);
  if (s) s.count++; else list.push({ symbol, reason, count: 1 });
}

/**
 * Interpreta as abas de uma planilha da B3. `known(symbol)` diz se o ativo
 * existe no catálogo do site; os demais aparecem como ignorados.
 */
export function parseB3(sheets: Sheet[], known: (symbol: string) => boolean): B3File {
  // 1) Extrato de negociação
  for (const sh of sheets) {
    const H = findHeader(sh.rows, ['data do negocio', 'codigo de negociacao', 'quantidade', 'preco']);
    if (!H) continue;
    const cDate = H.col('data do negocio'), cType = H.col('tipo de movimentacao'), cMkt = H.col('mercado'), cSym = H.col('codigo de negociacao'), cQty = H.col('quantidade'), cPx = H.col('preco');
    const trades: ParsedTrade[] = [], skipped: Skipped[] = [];
    const seen = new Map<string, number>();
    for (const r of sh.rows.slice(H.at + 1)) {
      const symbol = cleanTicker(r[cSym]);
      if (!symbol) continue;
      const date = toISODate(r[cDate]);
      const tipo = norm(r[cType]);
      const side = tipo.startsWith('compra') ? 'buy' : tipo.startsWith('venda') ? 'sell' : null;
      const qty = Math.abs(toNum(r[cQty])), price = toNum(r[cPx]);
      const mkt = cMkt >= 0 ? norm(r[cMkt]) : '';
      if (mkt && !/vista|fracionario/.test(mkt)) { addSkip(skipped, symbol, 'opções, termo ou futuro (não suportado)'); continue; }
      if (!date || !side || !(qty > 0) || !(price > 0)) { addSkip(skipped, symbol, 'linha incompleta'); continue; }
      if (!known(symbol)) { addSkip(skipped, symbol, 'ativo fora do catálogo do site'); continue; }
      const key = `${date}|${side}|${symbol}|${qty}|${price}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      trades.push({ symbol, side, qty, price, date, id: 'b3-' + hash(key + '|' + n) });
    }
    trades.sort((a, b) => a.date.localeCompare(b.date));
    return { kind: 'trades', trades, skipped };
  }

  // 2) Posição (uma aba por tipo de ativo: Ações, BDR, ETF, Fundos…)
  const positions = new Map<string, ParsedPosition>(), skipped: Skipped[] = [];
  let found = false;
  for (const sh of sheets) {
    const H = findHeader(sh.rows, ['codigo de negociacao', 'quantidade']);
    if (!H) continue;
    found = true;
    const cSym = H.col('codigo de negociacao'), cClose = H.col('preco de fechamento'), cVal = H.col('valor atualizado');
    // "Quantidade" exata (há também "Quantidade Disponível" e "Quantidade Indisponível")
    const qIdx = sh.rows[H.at].map(norm).findIndex((c) => c === 'quantidade');
    const cQ = qIdx >= 0 ? qIdx : H.col('quantidade');
    for (const r of sh.rows.slice(H.at + 1)) {
      const symbol = cleanTicker(r[cSym]);
      if (!symbol || /^total/i.test(symbol) || !/^[A-Z0-9]{4,12}$/.test(symbol)) continue;
      const qty = toNum(r[cQ]);
      let close = cClose >= 0 ? toNum(r[cClose]) : NaN;
      if (!(close > 0) && cVal >= 0 && qty > 0) close = toNum(r[cVal]) / qty;
      if (!(qty > 0)) { addSkip(skipped, symbol, 'linha incompleta'); continue; }
      if (!known(symbol)) { addSkip(skipped, symbol, 'ativo fora do catálogo do site'); continue; }
      const p = positions.get(symbol);
      if (p) p.qty += qty; // mesmo ativo em duas corretoras
      else positions.set(symbol, { symbol, qty, close: close > 0 ? close : 0 });
    }
  }
  if (found) return { kind: 'positions', positions: [...positions.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)), skipped };

  throw new Error('Não reconhecemos esta planilha. Use o Extrato de Negociação ou a Posição baixados em Excel na Área do Investidor da B3.');
}

export const positionId = (symbol: string, date: string) => 'b3pos-' + hash(symbol + '|' + date);

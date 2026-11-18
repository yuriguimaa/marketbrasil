import { cached, getJSON } from '../cache.js';
import { BCB_SERIES } from '../symbols.js';
import type { History, Period, Provider, Quotes } from '../types.js';

// Banco Central do Brasil — Sistema Gerenciador de Séries Temporais (SGS), sem chave
// A API limita consultas diárias a janelas de até 10 anos (e "ultimos" a 99 registros).
const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const url = (code: number, days: number) => {
  const end = new Date(), start = new Date(Date.now() - days * 86400_000);
  return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(end)}`;
};
const parseDate = (d: string) => { const [dd, mm, yy] = d.split('/'); return Date.UTC(+yy, +mm - 1, +dd) / 1000; };

/** `n` = pregões aproximados; converte para dias corridos (máx. ~10 anos). */
async function series(sym: string, n: number): Promise<{ time: number; value: number }[]> {
  const days = Math.min(3650, Math.ceil(n * 1.45) + 7);
  const rows = await cached<{ data: string; valor: string }[]>(`bcb:${sym}:${days}`, 6 * 3600_000, () => getJSON(url(BCB_SERIES[sym], days), { timeout: 20000 }));
  // a série da Selic meta inclui datas futuras (vigência); mantém só até hoje
  const now = Date.now() / 1000;
  return rows.map((r) => ({ time: parseDate(r.data), value: parseFloat(r.valor) }))
    .filter((r) => r.time <= now && isFinite(r.value)).sort((a, b) => a.time - b.time);
}

export const bcb: Provider = {
  id: 'bcb', name: 'Banco Central (SGS)', scope: 'Selic meta e CDI',
  enabled: () => true,
  note: 'API oficial, sem chave. Atualização diária.',
  supports: (s: string) => s in BCB_SERIES,

  async quotes(symbols: string[]): Promise<Quotes> {
    const out: Quotes = {};
    for (const sym of symbols.filter((s) => s in BCB_SERIES)) {
      const rows = await series(sym, 400);
      if (!rows.length) continue;
      const last = rows[rows.length - 1].value;
      const prev = rows.length > 1 ? rows[rows.length - 2].value : last;
      out[sym] = {
        symbol: sym, price: last, prevClose: prev, change: last - prev, changePct: prev ? ((last - prev) / prev) * 100 : 0,
        open: last, high: last, low: last, volume: 0, volumeFin: 0, updatedAt: rows[rows.length - 1].time * 1000,
        source: 'live', provider: 'Banco Central', spark: rows.slice(-120).map((r) => r.value),
      };
    }
    return out;
  },

  async history(symbol: string, period: Period): Promise<History | null> {
    if (!(symbol in BCB_SERIES)) return null;
    const n = ({ '1D': 5, '1S': 7, '1M': 25, '3M': 70, '6M': 130, '1A': 260, '5A': 1300, MAX: 2500 } as Record<Period, number>)[period];
    const rows = await series(symbol, n).catch((e) => { if (n > 1300) return series(symbol, 1300); throw e; });
    const seen = new Set<number>();
    const bars = rows.filter((r) => !seen.has(r.time) && seen.add(r.time))
      .map((r) => ({ time: r.time, open: r.value, high: r.value, low: r.value, close: r.value, volume: 0 }));
    return { bars, intraday: false, source: 'live' };
  },
};

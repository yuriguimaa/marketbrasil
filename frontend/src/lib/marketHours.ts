import type { AssetClass } from '../types';

/** Offset (min) de um fuso em relação ao UTC no instante `d`. */
export function tzOffsetMin(tz: string, d = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => +parts.find((p) => p.type === t)!.value;
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return Math.round((asUtc - d.getTime()) / 60000);
}

export interface Session {
  openUtcMin: number;
  closeUtcMin: number;
  isOpen: boolean;
  label: string;
}

/** Pregão regular (sem feriados — integrar calendário oficial no backend). */
export function marketSession(region: 'BR' | 'US', cls?: AssetClass, now = new Date()): Session {
  const tz = region === 'BR' ? 'America/Sao_Paulo' : 'America/New_York';
  const off = tzOffsetMin(tz, now);
  let openLocal: number, closeLocal: number;
  if (region === 'BR') {
    [openLocal, closeLocal] = cls === 'future' || cls === 'fx' ? [9 * 60, 18 * 60 + 25] : [10 * 60, 17 * 60];
  } else {
    [openLocal, closeLocal] = [9 * 60 + 30, 16 * 60];
  }
  const openUtcMin = openLocal - off;
  const closeUtcMin = closeLocal - off;
  const day = now.getUTCDay();
  const localDay = new Date(now.getTime() + off * 60000).getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const weekday = localDay !== 0 && localDay !== 6;
  const isOpen = weekday && mins >= openUtcMin && mins < closeUtcMin;
  void day;
  return {
    openUtcMin, closeUtcMin, isOpen,
    label: isOpen ? 'Aberto' : 'Fechado',
  };
}

export const clockIn = (tz: string, d = new Date()) =>
  d.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

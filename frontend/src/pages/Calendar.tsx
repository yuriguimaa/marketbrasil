import { useEffect, useMemo, useState } from 'react';
import { usePageMeta } from '../lib/pageMeta';
import { localRepo, useRepo } from '../services/storage';
import { api, type CalCategory, type CalEvent, type EconCalendar } from '../services/api';
import { Panel, Seg } from '../components/ui';
import { BullLogo } from '../components/Icon';

/**
 * Calendário econômico próprio: agenda da semana montada pelo backend com fontes abertas
 * (IBGE, Banco Central e Forex Factory). Horários em Brasília.
 */

type Country = CalEvent['country'];
const COUNTRIES: [Country, string, string][] = [['BR', 'Brasil', 'BRL'], ['US', 'Estados Unidos', 'USD'], ['EU', 'Zona do Euro', 'EUR']];
const IMPORTANCE: ['3' | '2' | '1', string][] = [['3', 'Alta'], ['2', 'Média'], ['1', 'Baixa']];
const CATEGORIES: [CalCategory, string][] = [
  ['inflation', 'Inflação'], ['centralBanks', 'Bancos centrais'], ['employment', 'Emprego'], ['activity', 'Atividade econômica'],
  ['confidence', 'Confiança'], ['trade', 'Balança comercial'], ['bonds', 'Títulos públicos'], ['other', 'Outros'], ['holiday', 'Feriados'],
];

interface Filters { countries: Country[]; importance: string[]; categories: CalCategory[]; period: 'day' | 'week' }
const calendarRepo = localRepo<Filters>('calendar-v2', {
  countries: ['BR', 'US', 'EU'], importance: ['3', '2'], categories: CATEGORIES.map((c) => c[0]), period: 'week',
});

const TZ = 'America/Sao_Paulo';
const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });
const hm = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayLabel = (t: number) => {
  const s = new Date(t).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string, string?][]; value: T[]; onChange: (v: T[]) => void }) {
  const all = value.length === options.length;
  return (
    <div className="cal-filter" role="group" aria-label={label}>
      <span className="cal-filter-label">{label}</span>
      <div className="cal-chips">
        {options.map(([id, name, code]) => {
          const on = value.includes(id);
          return (
            <button key={id} type="button" className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== id) : [...value, id])}>
              {name}{code && <span className="cal-cur">{code}</span>}
            </button>
          );
        })}
        {options.length > 3 && <button type="button" className="link-btn cal-all" onClick={() => onChange(all ? [] : options.map((o) => o[0]))}>{all ? 'Limpar' : 'Todas'}</button>}
      </div>
    </div>
  );
}

const IMP_LABEL = ['', 'Importância baixa', 'Importância média', 'Importância alta'];
function Importance({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span className={'cal-imp lv' + n} role="img" aria-label={IMP_LABEL[n]} title={IMP_LABEL[n]}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}><BullLogo size={13} color="currentColor" /></span>)}
    </span>
  );
}

export default function Calendar() {
  usePageMeta('Calendário Econômico', 'Agenda da semana com os indicadores do Brasil, Estados Unidos e Zona do Euro: inflação, juros, emprego e atividade, com importância, projeção e resultado.');
  const [f, setF] = useRepo(calendarRepo);
  const [data, setData] = useState<EconCalendar | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const load = () => api.calendar().then((d) => { if (!alive) return; if (d) { setData(d); setState('ok'); } else setState((s) => (s === 'ok' ? s : 'error')); });
    load();
    const t = setInterval(load, 15 * 60_000);
    const c = setInterval(() => setNow(Date.now()), 60_000);
    return () => { alive = false; clearInterval(t); clearInterval(c); };
  }, []);

  const today = dayKey(now);
  const shown = useMemo(() => (data?.events ?? []).filter((e) =>
    f.countries.includes(e.country) && f.importance.includes(String(e.importance)) && f.categories.includes(e.category)
    && (f.period === 'week' || dayKey(e.time) === today)), [data, f, today]);
  const days = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of shown) { const k = dayKey(e.time); m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m];
  }, [shown]);
  const nextId = shown.find((e) => !e.allDay && e.time >= now)?.id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendário Econômico</h1>
          <div className="sub">Indicadores e decisões de juros do Brasil, Estados Unidos e Zona do Euro · horário de Brasília</div>
        </div>
        <div className="actions">
          <Seg value={f.period} options={[['day', 'Hoje'], ['week', 'Esta semana']]} onChange={(period) => setF({ ...f, period })} />
        </div>
      </div>

      <Panel>
        <div className="cal-filters">
          <Chips label="País" options={COUNTRIES} value={f.countries} onChange={(countries) => setF({ ...f, countries })} />
          <Chips label="Importância" options={IMPORTANCE} value={f.importance as ('3' | '2' | '1')[]} onChange={(importance) => setF({ ...f, importance })} />
          <Chips label="Categoria" options={CATEGORIES} value={f.categories} onChange={(categories) => setF({ ...f, categories })} />
        </div>
      </Panel>

      <div style={{ marginTop: 12 }}>
        <Panel flush
          foot={<span className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            Fontes: <a href="https://www.ibge.gov.br/calendario-de-divulgacoes-do-ibge.html" target="_blank" rel="noopener noreferrer">IBGE</a>,{' '}
            <a href="https://www.bcb.gov.br/" target="_blank" rel="noopener noreferrer">Banco Central</a> (Copom, Focus e séries do SGS) e{' '}
            <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer">Forex Factory</a> (EUA e Zona do Euro).
            Projeções do Brasil: mediana do Boletim Focus. Resultados dos EUA e da Zona do Euro não aparecem em tempo real.
          </span>}>
          {state === 'loading' && <div className="empty" role="status">Carregando agenda…</div>}
          {state === 'error' && <div className="empty" role="alert">Não foi possível carregar a agenda agora. Tente de novo em alguns minutos.</div>}
          {state === 'ok' && data && data.partial.length > 0 && (
            <div className="cal-partial" role="status">Parte da agenda está indisponível no momento ({data.partial.join(', ')}). Os demais eventos estão abaixo.</div>
          )}
          {state === 'ok' && !shown.length && (
            <div className="empty">
              {!f.countries.length || !f.importance.length || !f.categories.length ? 'Escolha pelo menos um país, uma importância e uma categoria.'
                : f.period === 'day' ? 'Nenhum evento hoje com esses filtros. Veja a semana inteira.' : 'Nenhum evento nesta semana com esses filtros.'}
            </div>
          )}
          {state === 'ok' && shown.length > 0 && (
            <div className="cal-table" role="table" aria-label="Agenda econômica">
              <div className="cal-row cal-headrow" role="row">
                <span role="columnheader">Hora</span><span role="columnheader">País</span><span role="columnheader">Imp.</span>
                <span role="columnheader">Evento</span><span role="columnheader" className="r">Atual</span>
                <span role="columnheader" className="r">Projeção</span><span role="columnheader" className="r">Anterior</span>
              </div>
              {days.map(([key, evs]) => (
                <div key={key} role="rowgroup">
                  <div className={'cal-day' + (key === today ? ' today' : '')} role="row">
                    <span role="cell">{dayLabel(evs[0].time)}{key === today && <b> · hoje</b>}</span>
                  </div>
                  {evs.map((e) => {
                    const c = COUNTRIES.find((x) => x[0] === e.country)!;
                    const past = !e.allDay && e.time < now;
                    return (
                      <div key={e.id} role="row" className={'cal-row' + (past ? ' past' : '') + (e.id === nextId ? ' next' : '') + (e.allDay ? ' holiday' : '')}>
                        <span role="cell" className="cal-time num">{e.allDay ? 'Dia todo' : hm(e.time)}</span>
                        <span role="cell"><span className={'cal-cc ' + e.country} title={c[1]}>{c[2]}</span></span>
                        <span role="cell"><Importance n={e.importance} /></span>
                        <span role="cell" className="cal-title" title={'Fonte: ' + e.source}>{e.title}{e.id === nextId && <span className="cal-next">próximo</span>}</span>
                        <span role="cell" className="r num cal-actual" data-label="Atual">{e.actual ?? ''}</span>
                        <span role="cell" className="r num" data-label="Projeção">{e.forecast ?? ''}</span>
                        <span role="cell" className="r num muted" data-label="Anterior">{e.previous ?? ''}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

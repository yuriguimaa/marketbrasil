import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
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
const DEFAULTS: Filters = { countries: ['BR', 'US', 'EU'], importance: ['3', '2'], categories: CATEGORIES.map((c) => c[0]), period: 'week' };
const calendarRepo = localRepo<Filters>('calendar-v2', DEFAULTS);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

const TZ = 'America/Sao_Paulo';
const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });
const hm = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayLabel = (t: number) => {
  const s = new Date(t).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Lista suspensa de múltipla escolha: botão com o resumo da seleção e um painel
 * com caixas de seleção. Fecha ao clicar fora ou com Esc (o foco volta ao botão).
 */
function MultiSelect<T extends string>({ label, options, value, onChange, summary, renderOption }: {
  label: string; options: [T, string][]; value: T[]; onChange: (v: T[]) => void;
  summary: ReactNode; renderOption?: (id: T, name: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    root.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  const all = value.length === options.length;
  const toggle = (k: T) => onChange(value.includes(k) ? value.filter((x) => x !== k) : options.map((o) => o[0]).filter((o) => o === k || value.includes(o)));
  return (
    <div className={'msel' + (open ? ' open' : '')} ref={root}>
      <span className="msel-label" id={id + '-l'}>{label}</span>
      <button ref={btn} type="button" className={'msel-btn' + (value.length ? '' : ' empty')} aria-haspopup="true" aria-expanded={open}
        aria-controls={id + '-p'} aria-labelledby={id + '-l ' + id + '-v'} onClick={() => setOpen((o) => !o)}>
        <span className="msel-value" id={id + '-v'}>{summary}</span>
        <svg className="msel-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="msel-pop" id={id + '-p'} role="group" aria-label={label}>
          <div className="msel-head">
            <button type="button" className="link-btn" onClick={() => onChange(options.map((o) => o[0]))} disabled={all}>Selecionar todos</button>
            <button type="button" className="link-btn" onClick={() => onChange([])} disabled={!value.length}>Limpar</button>
          </div>
          <div className="msel-list">
            {options.map(([k, name]) => (
              <label key={k} className="msel-opt">
                <input type="checkbox" checked={value.includes(k)} onChange={() => toggle(k)} />
                <span className="msel-box" aria-hidden="true" />
                {renderOption ? renderOption(k, name) : <span className="msel-name">{name}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SHORT: Record<Country, string> = { BR: 'Brasil', US: 'EUA', EU: 'Zona do Euro' };
const joinPt = (xs: string[]) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);

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
  const isDefault = sameSet(f.countries, DEFAULTS.countries) && sameSet(f.importance, DEFAULTS.importance) && sameSet(f.categories, DEFAULTS.categories);

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

      <div className="cal-filterbar">
        <MultiSelect label="País" options={COUNTRIES.map(([k, n]) => [k, n] as [Country, string])} value={f.countries}
          onChange={(countries) => setF({ ...f, countries })}
          summary={f.countries.length === COUNTRIES.length ? 'Todos os países' : !f.countries.length ? 'Nenhum país'
            : joinPt(COUNTRIES.filter((c) => f.countries.includes(c[0])).map((c) => SHORT[c[0]]))}
          renderOption={(k, name) => <><span className="msel-name">{name}</span><span className={'cal-cc ' + k}>{COUNTRIES.find((c) => c[0] === k)![2]}</span></>} />
        <MultiSelect label="Categoria" options={CATEGORIES} value={f.categories}
          onChange={(categories) => setF({ ...f, categories })}
          summary={f.categories.length === CATEGORIES.length ? 'Todas as categorias' : !f.categories.length ? 'Nenhuma categoria'
            : f.categories.length <= 2 ? joinPt(CATEGORIES.filter((c) => f.categories.includes(c[0])).map((c) => c[1])) : `${f.categories.length} categorias`} />
        <MultiSelect label="Importância" options={IMPORTANCE} value={f.importance as ('3' | '2' | '1')[]}
          onChange={(importance) => setF({ ...f, importance })}
          summary={f.importance.length === 3 ? 'Qualquer' : !f.importance.length ? 'Nenhuma'
            : <span className="msel-tags"><Importance n={Math.max(...f.importance.map(Number)) as 1 | 2 | 3} /><span>{joinPt(IMPORTANCE.filter((i) => f.importance.includes(i[0])).map((i, n) => (n ? i[1].toLowerCase() : i[1])))}</span></span>}
          renderOption={(k, name) => <><Importance n={Number(k) as 1 | 2 | 3} /><span className="msel-name">{name}</span></>} />
        <div className="cal-meta">
          {state === 'ok' && <span className="num">{shown.length} {shown.length === 1 ? 'evento' : 'eventos'}</span>}
          {!isDefault && <button type="button" className="link-btn" onClick={() => setF({ ...DEFAULTS, period: f.period })}>Restaurar filtros</button>}
        </div>
      </div>

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

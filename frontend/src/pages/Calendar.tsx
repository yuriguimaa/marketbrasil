import { useState } from 'react';
import { usePageMeta } from '../lib/pageMeta';
import { localRepo, useRepo } from '../services/storage';
import { Panel, Seg } from '../components/ui';

/**
 * Calendário econômico pelo widget oficial e gratuito do Investing.com.
 * Os filtros desta página montam o endereço do widget; os dados vêm do Investing.com.
 */

const COUNTRIES: [string, string, string][] = [
  ['32', 'Brasil', 'BRL'],
  ['5', 'Estados Unidos', 'USD'],
  ['72', 'Zona do Euro', 'EUR'],
];
const IMPORTANCE: [string, string][] = [['3', 'Alta'], ['2', 'Média'], ['1', 'Baixa']];
const CATEGORIES: [string, string][] = [
  ['_inflation', 'Inflação'],
  ['_centralBanks', 'Bancos centrais'],
  ['_employment', 'Emprego'],
  ['_economicActivity', 'Atividade econômica'],
  ['_confidenceIndex', 'Confiança'],
  ['_balance', 'Balança comercial'],
  ['_credit', 'Crédito'],
  ['_Bonds', 'Títulos públicos'],
];

interface Filters { countries: string[]; importance: string[]; categories: string[]; period: 'day' | 'week'; dark: boolean }
const calendarRepo = localRepo<Filters>('calendar', {
  countries: COUNTRIES.map((c) => c[0]),
  importance: ['3', '2'],
  categories: CATEGORIES.map((c) => c[0]),
  period: 'week',
  dark: true,
});

function widgetUrl(f: Filters) {
  const p = new URLSearchParams({
    columns: 'exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous',
    category: f.categories.join(','),
    importance: f.importance.join(','),
    features: 'datepicker,timezone',
    countries: f.countries.join(','),
    calType: f.period,
    timeZone: '12', // (GMT -3:00) Brasília
    lang: '12', // português
  });
  return 'https://sslecal2.investing.com/?' + p.toString().replace(/%2C/g, ',');
}

function Chips({ label, options, value, onChange }: { label: string; options: [string, string, string?][]; value: string[]; onChange: (v: string[]) => void }) {
  const all = value.length === options.length;
  return (
    <div className="cal-filter" role="group" aria-label={label}>
      <span className="cal-filter-label">{label}</span>
      <div className="cal-chips">
        {options.map(([id, name, icon]) => {
          const on = value.includes(id);
          return (
            <button key={id} type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== id) : [...value, id])}>
              {name}{icon && <span className="cal-cur" aria-hidden="true">{icon}</span>}
            </button>
          );
        })}
        {options.length > 3 && (
          <button type="button" className="link-btn cal-all" onClick={() => onChange(all ? [] : options.map((o) => o[0]))}>
            {all ? 'Limpar' : 'Todas'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Calendar() {
  usePageMeta('Calendário Econômico', 'Agenda de indicadores econômicos do Brasil, Estados Unidos e Zona do Euro: inflação, juros, emprego e atividade, com importância, projeção e resultado.');
  const [f, setF] = useRepo(calendarRepo);
  const [loading, setLoading] = useState(true);
  const set = (p: Partial<Filters>) => { setLoading(true); setF({ ...f, ...p }); };

  const missing = !f.countries.length ? 'Escolha pelo menos um país.' : !f.importance.length ? 'Escolha pelo menos um nível de importância.' : !f.categories.length ? 'Escolha pelo menos uma categoria.' : '';
  const url = widgetUrl(f);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendário Econômico</h1>
          <div className="sub">Indicadores e decisões de juros do Brasil, Estados Unidos e Zona do Euro · horário de Brasília</div>
        </div>
        <div className="actions">
          <Seg value={f.period} options={[['day', 'Hoje'], ['week', 'Esta semana']]} onChange={(period) => set({ period })} />
        </div>
      </div>

      <Panel>
        <div className="cal-filters">
          <Chips label="País" options={COUNTRIES} value={f.countries} onChange={(countries) => set({ countries })} />
          <Chips label="Importância" options={IMPORTANCE} value={f.importance} onChange={(importance) => set({ importance })} />
          <Chips label="Categoria" options={CATEGORIES} value={f.categories} onChange={(categories) => set({ categories })} />
        </div>
      </Panel>

      <div style={{ marginTop: 12 }}>
        <Panel flush title="Agenda"
          right={<label className="cal-dark"><input type="checkbox" checked={f.dark} onChange={(e) => setF({ ...f, dark: e.target.checked })} /> Tema escuro</label>}
          foot={<span className="dim" style={{ fontSize: 11.5 }}>Dados fornecidos pelo <a href="https://br.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer">Calendário Econômico do Investing.com</a>. Use o seletor de datas dentro da agenda para ver outros dias.</span>}>
          {missing ? <div className="empty">{missing}</div> : (
            <div className={'cal-frame' + (f.dark ? ' dark' : '') + (loading ? ' loading' : '')}>
              <iframe key={url} src={url} title="Calendário econômico do Investing.com"
                referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)} />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

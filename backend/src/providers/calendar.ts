/**
 * Calendário econômico da semana (Brasil, EUA e Zona do Euro), montado só com fontes abertas:
 *  - Brasil: agenda oficial do IBGE (API v3), reuniões do Copom e Boletim Focus (Banco Central);
 *    valores anterior/atual pelas séries do SGS e projeções pelo Focus (Olinda).
 *  - EUA e Zona do Euro: feed semanal público do Forex Factory (importância, projeção e anterior;
 *    o feed não traz o resultado "atual").
 */
import { cached, getJSON } from '../cache.js';

export type CalCategory = 'inflation' | 'centralBanks' | 'employment' | 'activity' | 'confidence' | 'trade' | 'bonds' | 'holiday' | 'other';
export interface CalEvent {
  id: string;
  time: number; // ms (UTC)
  allDay?: boolean;
  country: 'BR' | 'US' | 'EU';
  title: string;
  importance: 1 | 2 | 3;
  category: CalCategory;
  actual?: string;
  forecast?: string;
  previous?: string;
  source: string;
}
export interface Calendar { from: number; to: number; events: CalEvent[]; updatedAt: number; partial: string[] }

const BRT = -3 * 3600_000; // Brasil sem horário de verão desde 2019
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Segunda 00:00 até domingo 23:59 (horário de Brasília) da semana atual, em ms UTC. */
export function currentWeek(now = Date.now()): { from: number; to: number } {
  const local = new Date(now + BRT);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = segunda
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
  const from = mondayLocal - BRT;
  return { from, to: from + 7 * 86400_000 - 1 };
}

const pct = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const ym = (t: number) => { const d = new Date(t + BRT); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; };
const shiftMonth = ({ y, m }: { y: number; m: number }, k: number) => { const t = new Date(Date.UTC(y, m + k, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; };

// ---------------------------------------------------------------- Banco Central

const SGS = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.';
const OLINDA = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata';
const isoDay = (t: number) => new Date(t + BRT).toISOString().slice(0, 10);
const dmy = (t: number) => { const d = new Date(t + BRT); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };

/** Últimas observações mensais de uma série do SGS: chave "AAAA-MM". */
async function sgsMonthly(code: number): Promise<Map<string, number>> {
  const rows = await cached<{ data: string; valor: string }[]>(`cal:sgs:${code}`, 3600_000,
    () => getJSON(`${SGS}${code}/dados/ultimos/6?formato=json`, { timeout: 15000 }));
  const m = new Map<string, number>();
  for (const r of rows) { const [, mm, yy] = r.data.split('/'); const v = parseFloat(r.valor); if (isFinite(v)) m.set(`${yy}-${mm}`, v); }
  return m;
}

/** Mediana do Focus para o mês de referência, na última pesquisa até `asOf` (antes da divulgação). */
async function focusMonthly(indicator: string, ref: { y: number; m: number }, asOf: number): Promise<number | undefined> {
  const r = `${String(ref.m + 1).padStart(2, '0')}/${ref.y}`;
  const q = `$top=1&$filter=Indicador%20eq%20'${indicator}'%20and%20DataReferencia%20eq%20'${r}'%20and%20baseCalculo%20eq%200%20and%20Data%20lt%20'${isoDay(asOf)}'&$orderby=Data%20desc&$format=json&$select=Mediana`;
  const j = await cached<{ value: { Mediana: number }[] }>(`cal:focus:${indicator}:${r}:${isoDay(asOf)}`, 6 * 3600_000, () => getJSON(`${OLINDA}/ExpectativaMercadoMensais?${q}`, { timeout: 15000 }));
  return j.value[0]?.Mediana;
}

async function focusSelic(meeting: string, asOf: number): Promise<number | undefined> {
  const q = `$top=1&$filter=Reuniao%20eq%20'${meeting}'%20and%20baseCalculo%20eq%200%20and%20Data%20lt%20'${isoDay(asOf)}'&$orderby=Data%20desc&$format=json&$select=Mediana`;
  const j = await cached<{ value: { Mediana: number }[] }>(`cal:focus:selic:${meeting}:${isoDay(asOf)}`, 6 * 3600_000, () => getJSON(`${OLINDA}/ExpectativasMercadoSelic?${q}`, { timeout: 15000 }));
  return j.value[0]?.Mediana;
}

/**
 * Dias de decisão do Copom (comunicado ~18h30). Fonte: calendários publicados pelo Banco Central
 * (2026: comunicado de 24/06/2025; 2027: comunicado nº 45.452, de 23/06/2026). Atualizar todo ano.
 */
const COPOM: Record<number, string[]> = {
  2026: ['01-28', '03-18', '04-29', '06-17', '08-05', '09-16', '11-04', '12-09'],
  2027: ['01-27', '03-17', '04-28', '06-16', '08-04', '09-22', '10-27'],
};

async function copomEvents(from: number, to: number): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  for (const [year, days] of Object.entries(COPOM)) {
    days.forEach((md, i) => {
      const time = Date.parse(`${year}-${md}T18:30:00-03:00`);
      if (time < from || time > to) return;
      out.push({ id: `copom-${year}-${i + 1}`, time, country: 'BR', title: 'Decisão da taxa de juros (Copom)', importance: 3, category: 'centralBanks', source: 'Banco Central' });
    });
  }
  await Promise.all(out.map(async (e) => {
    const [year, n] = e.id.split('-').slice(1);
    const [selic, f] = await Promise.allSettled([
      cached<{ data: string; valor: string }[]>(`cal:selic:${e.id}`, 3600_000,
        () => getJSON(`${SGS}432/dados?formato=json&dataInicial=${dmy(e.time - 10 * 86400_000)}&dataFinal=${dmy(e.time + 3 * 86400_000)}`, { timeout: 15000 })),
      focusSelic(`R${n}/${year}`, e.time),
    ]);
    if (f.status === 'fulfilled' && f.value != null) e.forecast = pct(f.value);
    if (selic.status === 'fulfilled') {
      const day = dmy(e.time);
      const before = selic.value.filter((r) => { const [d, m, y] = r.data.split('/'); return `${y}${m}${d}` < day.split('/').reverse().join(''); }).pop();
      if (before) e.previous = pct(parseFloat(before.valor));
      // a série já traz a meta vigente nos dias seguintes; só vale como resultado depois do anúncio
      const after = selic.value.find((r) => { const [d, m, y] = r.data.split('/'); return `${y}${m}${d}` > day.split('/').reverse().join(''); });
      if (after && Date.now() > e.time + 30 * 60_000) e.actual = pct(parseFloat(after.valor));
    }
  }));
  return out;
}

/** Boletim Focus: toda segunda-feira, 8h25. */
function focusEvents(from: number): CalEvent[] {
  const time = from + (8 * 60 + 25) * 60_000;
  return [{ id: `focus-${dmy(time)}`, time, country: 'BR', title: 'Boletim Focus', importance: 2, category: 'other', source: 'Banco Central' }];
}

// ---------------------------------------------------------------- IBGE

interface IbgeItem { id: number; titulo: string; data_divulgacao: string; nome_produto: string }
interface IbgeRule { match: (p: string) => boolean; title: string; importance: 1 | 2 | 3; category: CalCategory; sgs?: number; refOffset: number; focus?: string; period?: 'quarter' }

const IBGE_RULES: IbgeRule[] = [
  { match: (p) => p === 'Índice Nacional de Preços ao Consumidor Amplo', title: 'IPCA - Inflação (mensal)', importance: 3, category: 'inflation', sgs: 433, refOffset: -1, focus: 'IPCA' },
  { match: (p) => p === 'Índice Nacional de Preços ao Consumidor Amplo 15', title: 'IPCA-15 (mensal)', importance: 2, category: 'inflation', sgs: 7478, refOffset: 0 },
  { match: (p) => p === 'Índice Nacional de Preços ao Consumidor', title: 'INPC (mensal)', importance: 1, category: 'inflation', sgs: 188, refOffset: -1 },
  { match: (p) => p.startsWith('Índice de Preços ao Produtor'), title: 'Índice de Preços ao Produtor (IPP)', importance: 1, category: 'inflation', refOffset: -1 },
  { match: (p) => p === 'Sistema de Contas Nacionais Trimestrais', title: 'PIB (trimestral)', importance: 3, category: 'activity', refOffset: 0, period: 'quarter' },
  { match: (p) => p.startsWith('Divulgação mensal#pnadc1'), title: 'Taxa de desemprego (PNAD Contínua)', importance: 2, category: 'employment', sgs: 24369, refOffset: -1 },
  { match: (p) => p.startsWith('PIM-PF Brasil'), title: 'Produção industrial (mensal)', importance: 2, category: 'activity', refOffset: -2 },
  { match: (p) => p === 'Pesquisa Mensal de Comércio', title: 'Vendas no varejo (mensal)', importance: 2, category: 'activity', refOffset: -2 },
  { match: (p) => p === 'Pesquisa Mensal de Serviços', title: 'Volume de serviços (mensal)', importance: 1, category: 'activity', refOffset: -2 },
];

/** "18/11/2026 12:00:00" — o IBGE informa o horário em UTC (divulgações às 9h de Brasília). */
const ibgeTime = (s: string) => { const [d, h] = s.split(' '); const [dd, mm, yy] = d.split('/'); return Date.parse(`${yy}-${mm}-${dd}T${h ?? '12:00:00'}Z`); };
const mmddyyyy = (t: number) => { const d = new Date(t + BRT); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`; };

async function ibgeEvents(from: number, to: number): Promise<CalEvent[]> {
  const j = await cached<{ items: IbgeItem[] }>(`cal:ibge:${mmddyyyy(from)}`, 6 * 3600_000,
    () => getJSON(`https://servicodados.ibge.gov.br/api/v3/calendario/?de=${mmddyyyy(from)}&ate=${mmddyyyy(to)}&qtd=200`, { timeout: 15000 }));
  const out: CalEvent[] = [];
  await Promise.all(j.items.map(async (it) => {
    const rule = IBGE_RULES.find((r) => r.match(it.nome_produto ?? ''));
    const time = ibgeTime(it.data_divulgacao);
    if (!rule || !(time >= from && time <= to)) return;
    const ref = shiftMonth(ym(time), rule.refOffset);
    const label = rule.period === 'quarter' ? `${Math.floor(shiftMonth(ym(time), -3).m / 3) + 1}º tri` : MONTHS[ref.m];
    const e: CalEvent = { id: `ibge-${it.id}`, time, country: 'BR', title: `${rule.title} (${label})`, importance: rule.importance, category: rule.category, source: 'IBGE' };
    const [obs, fc] = await Promise.allSettled([rule.sgs ? sgsMonthly(rule.sgs) : Promise.resolve(null), rule.focus ? focusMonthly(rule.focus, ref, time) : Promise.resolve(undefined)]);
    if (obs.status === 'fulfilled' && obs.value) {
      const key = (r: { y: number; m: number }) => `${r.y}-${String(r.m + 1).padStart(2, '0')}`;
      const cur = obs.value.get(key(ref)), prev = obs.value.get(key(shiftMonth(ref, -1)));
      if (cur != null && Date.now() >= time) e.actual = pct(cur);
      if (prev != null) e.previous = pct(prev);
    }
    if (fc.status === 'fulfilled' && fc.value != null) e.forecast = pct(fc.value);
    out.push(e);
  }));
  return out;
}

// ---------------------------------------------------------------- EUA e Zona do Euro

interface FFItem { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string }

const PREFIX: [RegExp, string][] = [[/^German /, 'Alemanha: '], [/^French /, 'França: '], [/^Italian /, 'Itália: '], [/^Spanish /, 'Espanha: ']];
const NAMES: [RegExp, string][] = [
  [/^Core CPI/, 'Núcleo do IPC'], [/^CPI/, 'Índice de Preços ao Consumidor (IPC)'], [/^Core PPI/, 'Núcleo do IPP'], [/^PPI/, 'Índice de Preços ao Produtor (IPP)'],
  [/^Core PCE Price Index/, 'Núcleo do PCE'], [/^PCE Price Index/, 'Índice de preços PCE'], [/^Final Core CPI/, 'Núcleo do IPC (final)'], [/^Final CPI/, 'IPC (final)'],
  [/^Flash CPI/, 'IPC (prévia)'], [/^Flash Core CPI/, 'Núcleo do IPC (prévia)'], [/^Prelim CPI/, 'IPC (preliminar)'],
  [/^ADP Non-Farm Employment Change/, 'Variação de empregos ADP'], [/^Non-Farm Employment Change/, 'Criação de empregos (Payroll)'],
  [/^Unemployment Claims/, 'Pedidos de seguro-desemprego'], [/^Unemployment Rate/, 'Taxa de desemprego'], [/^JOLTS Job Openings/, 'Vagas de emprego (JOLTS)'],
  [/^Average Hourly Earnings/, 'Ganho médio por hora'], [/^Employment Cost Index/, 'Índice de custo do emprego'], [/^Unemployment Change/, 'Variação do desemprego'],
  [/^Federal Funds Rate/, 'Decisão da taxa de juros (Fed)'], [/^FOMC Meeting Minutes/, 'Ata do FOMC'], [/^FOMC Statement/, 'Comunicado do FOMC'],
  [/^FOMC Press Conference/, 'Entrevista coletiva do FOMC'], [/^FOMC Economic Projections/, 'Projeções econômicas do FOMC'],
  [/^Main Refinancing Rate/, 'Decisão da taxa de juros (BCE)'], [/^Monetary Policy Statement/, 'Comunicado de política monetária (BCE)'],
  [/^ECB Press Conference/, 'Entrevista coletiva do BCE'], [/^ECB Monetary Policy Meeting Accounts/, 'Ata do BCE'],
  [/^Advance GDP Price Index/, 'Deflator do PIB (preliminar)'], [/^Advance GDP/, 'PIB (preliminar)'], [/^Prelim GDP/, 'PIB (preliminar)'], [/^Final GDP/, 'PIB (final)'], [/^Flash GDP/, 'PIB (prévia)'], [/^GDP/, 'PIB'],
  [/^Core Retail Sales/, 'Núcleo das vendas no varejo'], [/^Retail Sales/, 'Vendas no varejo'],
  [/^ISM Manufacturing PMI/, 'PMI industrial ISM'], [/^ISM Services PMI/, 'PMI de serviços ISM'], [/^ISM Manufacturing Prices/, 'Preços industriais ISM'],
  [/^Flash Manufacturing PMI/, 'PMI industrial (prévia)'], [/^Flash Services PMI/, 'PMI de serviços (prévia)'], [/^Final Manufacturing PMI/, 'PMI industrial (final)'],
  [/^Final Services PMI/, 'PMI de serviços (final)'], [/^Manufacturing PMI/, 'PMI industrial'], [/^Services PMI/, 'PMI de serviços'], [/^Chicago PMI/, 'PMI de Chicago'],
  [/^Industrial Production/, 'Produção industrial'], [/^Core Durable Goods Orders/, 'Núcleo das encomendas de bens duráveis'], [/^Durable Goods Orders/, 'Encomendas de bens duráveis'],
  [/^Factory Orders/, 'Encomendas à indústria'], [/^Building Permits/, 'Licenças de construção'], [/^Housing Starts/, 'Início de construções de casas'],
  [/^Existing Home Sales/, 'Vendas de casas usadas'], [/^New Home Sales/, 'Vendas de casas novas'], [/^Pending Home Sales/, 'Vendas pendentes de casas'],
  [/^CB Consumer Confidence/, 'Confiança do consumidor (Conference Board)'], [/^Prelim UoM Consumer Sentiment/, 'Sentimento do consumidor Michigan (prévia)'],
  [/^Revised UoM Consumer Sentiment/, 'Sentimento do consumidor Michigan (revisado)'], [/^UoM Inflation Expectations/, 'Expectativa de inflação Michigan'],
  [/ZEW Economic Sentiment/, 'Sentimento econômico ZEW'], [/Ifo Business Climate/, 'Clima de negócios Ifo'], [/Consumer Confidence/, 'Confiança do consumidor'],
  [/Consumer Climate/, 'Clima do consumidor'], [/Sentix Investor Confidence/, 'Confiança do investidor Sentix'],
  [/^Trade Balance/, 'Balança comercial'], [/^Current Account/, 'Conta corrente'], [/^Crude Oil Inventories/, 'Estoques de petróleo bruto'], [/^Natural Gas Storage/, 'Estoques de gás natural'],
  [/^Empire State Manufacturing Index/, 'Índice Empire State'], [/^Philly Fed Manufacturing Index/, 'Índice industrial do Fed da Filadélfia'], [/^Richmond Manufacturing Index/, 'Índice industrial do Fed de Richmond'],
  [/^Personal Spending/, 'Gastos pessoais'], [/^Personal Income/, 'Renda pessoal'], [/^Prelim Unit Labor Costs/, 'Custo unitário do trabalho (preliminar)'], [/^Prelim Nonfarm Productivity/, 'Produtividade (preliminar)'],
  [/^Cleveland Fed Inflation Expectations/, 'Expectativa de inflação do Fed de Cleveland'], [/^EU Economic Forecasts/, 'Projeções econômicas da Comissão Europeia'],
  [/^ADP Weekly Employment Change/, 'Variação semanal de empregos ADP'], [/^Import Prices/, 'Preços de importação'], [/^Export Prices/, 'Preços de exportação'],
  [/^Capacity Utilization Rate/, 'Utilização da capacidade instalada'], [/^Business Inventories/, 'Estoques das empresas'], [/^NAHB Housing Market Index/, 'Índice do mercado imobiliário NAHB'],
  [/^API Weekly Statistical Bulletin/, 'Estoques de petróleo (API)'], [/^TIC Long-Term Purchases/, 'Compras de títulos de longo prazo (TIC)'], [/^Buba Monthly Report/, 'Relatório mensal do Bundesbank'],
  [/^CB Leading Index/, 'Indicadores antecedentes (Conference Board)'], [/^Mortgage Delinquencies/, 'Inadimplência de hipotecas'], [/^Revised UoM Inflation Expectations/, 'Expectativa de inflação Michigan (revisada)'],
  [/^Prelim UoM Inflation Expectations/, 'Expectativa de inflação Michigan (prévia)'], [/^Wholesale Inventories/, 'Estoques no atacado'], [/^Construction Spending/, 'Gastos com construção'],
  [/^Federal Budget Balance/, 'Resultado orçamentário federal'], [/^Treasury Currency Report/, 'Relatório cambial do Tesouro'], [/^Bank Holiday/, 'Feriado bancário'],
  [/^(\d+)-y Bond Auction/, 'Leilão de títulos de $1 anos'], [/^(\d+)-y Note Auction/, 'Leilão de notas de $1 anos'], [/^M3 Money Supply/, 'Oferta monetária M3'],
  [/^Private Loans/, 'Empréstimos ao setor privado'], [/^ECB Financial Stability Review/, 'Relatório de estabilidade financeira do BCE'], [/^Eurogroup Meetings/, 'Reunião do Eurogrupo'],
];
const SUFFIX: [RegExp, string][] = [[/ m\/m$/, ' (mensal)'], [/ q\/q$/, ' (trimestral)'], [/ y\/y$/, ' (anual)']];

export function translateFF(title: string): string {
  let t = title.trim(), pre = '';
  for (const [re, p] of PREFIX) if (re.test(t)) { pre = p; t = t.replace(re, ''); break; }
  let suf = '';
  for (const [re, s] of SUFFIX) if (re.test(t)) { suf = s; t = t.replace(re, ''); break; }
  // discursos: "Fed Chair Powell Speaks", "FOMC Member Waller Speaks", "ECB President Lagarde Speaks"
  let m = t.match(/^(?:Fed Chairman|Fed Chair|FOMC Member|Fed Governor|Fed Vice Chair(?: for Supervision)?|ECB President|ECB Vice President|ECB Chief Economist|German Buba President|Buba President|ECB) ([A-Z][\w'-]+) Speaks$/);
  if (m) {
    const role = /Fed Chair/.test(t) ? 'presidente do Fed' : /FOMC Member/.test(t) ? 'membro do FOMC' : /Fed Governor/.test(t) ? 'diretor do Fed' : /Fed Vice/.test(t) ? 'vice-presidente do Fed'
      : /ECB President/.test(t) ? 'presidente do BCE' : /ECB Vice/.test(t) ? 'vice-presidente do BCE' : /Buba/.test(t) ? 'presidente do Bundesbank' : 'membro do BCE';
    return `${pre}Discurso de ${m[1]}, ${role}`;
  }
  if ((m = t.match(/^(.+) Speaks$/))) return `${pre}Discurso: ${m[1]}`;
  for (const [re, pt] of NAMES) if (re.test(t)) return pre + t.replace(re, pt).replace(/\s+$/, '') + suf;
  return pre + t + suf;
}

export function categorizeFF(title: string, impact: string): CalCategory {
  if (/holiday/i.test(impact) || /Holiday/.test(title)) return 'holiday';
  if (/CPI|PPI|PCE|Inflation|Price Index|Prices/.test(title)) return 'inflation';
  if (/Manufacturing Index|PMI|Housing Market Index|Leading Index/.test(title)) return 'activity';
  if (/Fed|FOMC|ECB|Funds Rate|Refinancing|Monetary Policy|Buba|Lagarde|Speaks/.test(title)) return 'centralBanks';
  if (/Employment|Payroll|Unemployment|Claims|JOLTS|Earnings|Labor|Jobless/.test(title)) return 'employment';
  if (/Confidence|Sentiment|ZEW|Ifo|Climate/.test(title)) return 'confidence';
  if (/Trade Balance|Current Account|Import|Export/.test(title)) return 'trade';
  if (/Auction|Bond|Note/.test(title)) return 'bonds';
  if (/GDP|PMI|Sales|Production|Orders|Housing|Home|Permits|Manufacturing|Spending|Income|Inventories|Storage|Productivity|Index/.test(title)) return 'activity';
  return 'other';
}

/** "0.3%" → "0,3%"; "1,234.5K" → "1.234,5K". */
const brNum = (v?: string) => { const t = v?.trim(); return t ? t.replace(/,/g, '~').replace(/\./g, ',').replace(/~/g, '.') : undefined; };

/**
 * O Forex Factory marca como "baixa" alguns indicadores que o mercado brasileiro acompanha de perto
 * (IPC final da Zona do Euro, estoques de petróleo etc.). Piso de importância por indicador,
 * próximo ao que os calendários do mercado brasileiro usam. Nunca rebaixa o que a fonte informa.
 */
const FLOOR_3 = /^(Core |Flash |Final |Prelim |Flash Core |Final Core )?CPI|^(Advance |Prelim |Final |Flash )?GDP(?! Price)|^Non-Farm Employment|^Unemployment Rate|^Federal Funds Rate|^Main Refinancing Rate|^FOMC (Statement|Meeting Minutes|Press Conference)|^ECB Press Conference|^ISM (Manufacturing|Services) PMI|^(Core )?Retail Sales|^Core PCE Price Index/;
const FLOOR_2 = /PPI|^Crude Oil Inventories|^Unemployment Claims|^ADP Non-Farm|^JOLTS|^Building Permits|^Housing Starts|^(Existing|New|Pending) Home Sales|^Industrial Production|Durable Goods|^Flash .*PMI|ZEW|Ifo|UoM|^CB Consumer Confidence|^Philly Fed|^Empire State|^Trade Balance|Consumer Confidence|^Natural Gas Storage|^Personal (Spending|Income)|^Average Hourly Earnings|^PCE Price Index|^Fed Chair|^ECB President|^Monetary Policy Statement|^Employment Cost Index/;
export function floorImportance(title: string): 1 | 2 | 3 {
  const t = title.replace(/^(German|French|Italian|Spanish) /, '');
  if (/^(German|French|Italian|Spanish) /.test(title)) return FLOOR_2.test(t) || FLOOR_3.test(t) ? 2 : 1; // dados de um país do bloco
  return FLOOR_3.test(t) ? 3 : FLOOR_2.test(t) ? 2 : 1;
}

async function ffEvents(from: number, to: number): Promise<CalEvent[]> {
  // o Forex Factory pede no máximo algumas consultas por hora: cache de 1 hora
  const items = await cached<FFItem[]>('cal:ff:thisweek', 3600_000,
    () => getJSON('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBrasil/0.1)' } }));
  const out: CalEvent[] = [];
  items.forEach((it, i) => {
    const country = it.country === 'USD' ? 'US' : it.country === 'EUR' ? 'EU' : null;
    const time = Date.parse(it.date);
    if (!country || !isFinite(time) || time < from || time > to) return;
    const category = categorizeFF(it.title, it.impact);
    const importance = Math.max(it.impact === 'High' ? 3 : it.impact === 'Medium' ? 2 : 1, floorImportance(it.title)) as 1 | 2 | 3;
    out.push({
      id: `ff-${country}-${time}-${i}`, time, allDay: category === 'holiday', country, title: translateFF(it.title), importance, category,
      forecast: brNum(it.forecast), previous: brNum(it.previous), source: 'Forex Factory',
    });
  });
  return out;
}

// ---------------------------------------------------------------- junção

export const calendar = {
  /** `now` permite consultar outra semana (testes). */
  async week(now = Date.now()): Promise<Calendar> {
    const { from, to } = currentWeek(now);
    return cached(`cal:week:${from}`, 15 * 60_000, async () => {
      const parts: [string, Promise<CalEvent[]>][] = [
        ['IBGE', ibgeEvents(from, to)], ['Copom', copomEvents(from, to)], ['Forex Factory', ffEvents(from, to)],
      ];
      const settled = await Promise.allSettled(parts.map((p) => p[1]));
      const partial: string[] = [];
      const events: CalEvent[] = [...focusEvents(from)];
      settled.forEach((s, i) => {
        if (s.status === 'fulfilled') events.push(...s.value);
        else { partial.push(parts[i][0]); console.warn('[calendar]', parts[i][0], (s.reason as Error)?.message); }
      });
      if (partial.length === parts.length) throw new Error('calendário indisponível');
      events.sort((a, b) => a.time - b.time || b.importance - a.importance);
      return { from, to, events, updatedAt: Date.now(), partial };
    });
  },
};

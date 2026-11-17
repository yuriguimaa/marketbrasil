import { usePageMeta } from '../lib/pageMeta';
import { Panel, Seg } from '../components/ui';
import { portfolioRepo, settingsRepo, useRepo, watchlistRepo } from '../services/storage';
import { refreshNow, useMarket } from '../services/marketData';
import { timeHM } from '../lib/format';

export default function Settings() {
  usePageMeta('Configurações', undefined, { noindex: true });
  const [s, set] = useRepo(settingsRepo);
  const backend = useMarket((x) => x.backend);
  const providers = useMarket((x) => x.providers);
  const last = useMarket((x) => x.lastUpdate);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ watchlists: watchlistRepo.get(), portfolio: portfolioRepo.get(), settings: settingsRepo.get() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'marketbrasil-dados.json'; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="page-head"><div><h1>Configurações</h1><div className="sub">Preferências salvas neste navegador</div></div></div>
      <div className="grid g-2">
        <Panel title="Exibição">
          <div style={{ display: 'grid', gap: 16 }}>
            <Row label="Intervalo de atualização" hint="Frequência de atualização das cotações">
              <Seg value={String(s.refreshSec)} options={[['3', '3s'], ['5', '5s'], ['15', '15s'], ['60', '1 min']]} onChange={(v) => set({ ...s, refreshSec: +v })} />
            </Row>
            <Row label="Densidade das tabelas" hint="Compacta mostra mais linhas por tela">
              <Seg value={s.density} options={[['compact', 'Compacta'], ['comfortable', 'Confortável']]} onChange={(v) => set({ ...s, density: v })} />
            </Row>
            <Row label="Selo “DEMO” nos dados fictícios" hint="Recomendado manter ativado">
              <Seg value={s.showDemoBadges ? 'on' : 'off'} options={[['on', 'Mostrar'], ['off', 'Ocultar']]} onChange={(v) => set({ ...s, showDemoBadges: v === 'on' })} />
            </Row>
          </div>
        </Panel>

        <Panel title="Fontes de dados" right={<button className="btn sm" onClick={() => refreshNow()}>Atualizar agora</button>}
          foot={<span>Última atualização: {last ? timeHM(last) : '—'}</span>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className={'dot ' + (backend === 'online' ? 'on' : 'warn')} />
            <b>Backend {backend === 'online' ? 'conectado' : backend === 'checking' ? 'verificando…' : 'desconectado'}</b>
            <span className="dim">· {backend === 'online' ? 'serviço de dados em /api' : 'exibindo dados de demonstração'}</span>
          </div>
          {providers.length ? (
            <table className="t"><tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td className="l"><b>{p.name}</b><div className="dim" style={{ fontSize: 11 }}>{p.scope}</div></td>
                  <td className="l muted" style={{ whiteSpace: 'normal', fontSize: 11.5 }}>{p.note}</td>
                  <td><span className={'tag ' + (p.enabled ? 'live' : 'demo')}>{p.enabled ? 'ATIVO' : 'SEM CHAVE'}</span></td>
                </tr>
              ))}
            </tbody></table>
          ) : (
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Inicie o serviço de dados com <code>npm run dev:api</code>. Chaves de API ficam no arquivo <code>backend/.env</code> (nunca no navegador):
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li><b>BRAPI_TOKEN</b> — cotações B3 (brapi.dev)</li>
                <li><b>FINNHUB_TOKEN</b> — cotações EUA (finnhub.io)</li>
                <li>Cripto (CoinGecko), câmbio (AwesomeAPI), Selic/CDI (Banco Central) e notícias (RSS) funcionam sem chave.</li>
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Seus dados">
          <div style={{ display: 'grid', gap: 12 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Watchlists, carteira e preferências ficam armazenadas apenas neste navegador. Não é necessário criar conta.</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportData}>Exportar dados (JSON)</button>
              <button className="btn danger" onClick={() => { if (confirm('Apagar todas as operações da carteira? Esta ação não pode ser desfeita.')) portfolioRepo.set([]); }}>Limpar carteira</button>
              <button className="btn danger" onClick={() => { if (confirm('Apagar todas as watchlists?')) watchlistRepo.set([]); }}>Limpar watchlists</button>
            </div>
          </div>
        </Panel>

        <Panel title="Sobre">
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            MarketBrasil — painel de acompanhamento dos mercados brasileiro, americano e cripto. As informações têm caráter exclusivamente informativo e não constituem recomendação de compra ou venda de ativos.
            Cotações de bolsa podem ter atraso conforme o provedor; o atraso é indicado em cada cotação.
          </div>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 500 }}>{label}</div>{hint && <div className="dim" style={{ fontSize: 11.5 }}>{hint}</div>}</div>
      {children}
    </div>
  );
}

import { Component, type ReactNode } from 'react';

/** Evita tela em branco: se uma página quebrar, mostra o erro e permite recarregar. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error('[ui]', error); }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel" role="alert" style={{ maxWidth: 560, margin: '40px auto' }}>
        <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Não foi possível exibir esta página</h1>
          <p className="muted" style={{ margin: 0 }}>Ocorreu um erro inesperado ao montar a página. Seus dados salvos não foram afetados.</p>
          <code className="dim" style={{ fontSize: 11.5, wordBreak: 'break-word' }}>{this.state.error.message}</code>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={() => location.reload()}>Recarregar página</button>
            <a className="btn" href="/">Ir para a Visão Geral</a>
          </div>
        </div>
      </div>
    );
  }
}

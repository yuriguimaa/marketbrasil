import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageMeta } from '../lib/pageMeta';
import { authEnabled, authMessage, getClient, sendReset, signIn, signUp, updatePassword, useAuth } from '../services/auth';
import { Seg } from '../components/ui';

type Mode = 'entrar' | 'criar' | 'esqueci';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  usePageMeta('Entrar', 'Entre para guardar sua carteira na conta e acessar de qualquer dispositivo.', { noindex: true });
  const auth = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  // carrega o Supabase ao abrir a tela (troca de senha chega por aqui)
  useEffect(() => { if (authEnabled) void getClient().catch(() => {}); }, []);
  useEffect(() => { if (auth.user && !auth.recovery) nav('/carteira', { replace: true }); }, [auth.user, auth.recovery, nav]);

  if (!authEnabled) return <div className="auth-wrap"><div className="auth-card"><h1>Entrar</h1><p className="muted">O login não está disponível neste ambiente. Sua carteira continua salva neste navegador.</p></div></div>;

  const run = async (fn: () => Promise<void>) => {
    setError(undefined); setDone(undefined); setBusy(true);
    try { await fn(); } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };

  if (auth.recovery) {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={(e) => { e.preventDefault(); if (pw.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.'); void run(async () => { await updatePassword(pw); nav('/carteira', { replace: true }); }); }}>
          <h1>Criar nova senha</h1>
          <label className="field">Nova senha<input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoFocus /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        </form>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL.test(em)) return setError('Informe um e-mail válido.');
    if (mode === 'esqueci') return void run(async () => { await sendReset(em); setDone(`Se existir uma conta com ${em}, enviamos um link para criar uma nova senha.`); });
    if (mode === 'criar' && pw.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (!pw) return setError('Informe sua senha.');
    void run(async () => {
      if (mode === 'entrar') await signIn(em, pw);
      else if (await signUp(em, pw)) { setDone(`Conta criada. Enviamos um link de confirmação para ${em}. Abra o e-mail e clique no link para entrar.`); setPw(''); }
    });
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>{mode === 'criar' ? 'Criar conta' : mode === 'esqueci' ? 'Recuperar senha' : 'Entrar'}</h1>
        <p className="muted">O MarketBrasil é gratuito e aberto. A conta serve só para guardar sua carteira e acessar de qualquer dispositivo.</p>
        {mode !== 'esqueci' && <Seg value={mode} options={[['entrar', 'Entrar'], ['criar', 'Criar conta']]} onChange={(m) => { setMode(m); setError(undefined); setDone(undefined); }} />}
        <label className="field">E-mail<input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        {mode !== 'esqueci' && (
          <label className="field">Senha{mode === 'criar' && <span className="dim"> (mínimo 8 caracteres)</span>}
            <input className="input" type="password" autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} required />
          </label>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        {done && <div className="form-ok" role="status">{done}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'criar' ? 'Criar conta' : mode === 'esqueci' ? 'Enviar link' : 'Entrar'}
        </button>
        <div className="auth-links">
          {mode === 'esqueci'
            ? <button type="button" className="link-btn" onClick={() => { setMode('entrar'); setError(undefined); setDone(undefined); }}>Voltar para entrar</button>
            : <button type="button" className="link-btn" onClick={() => { setMode('esqueci'); setError(undefined); setDone(undefined); }}>Esqueci a senha</button>}
          <Link to="/sobre#privacidade">Privacidade</Link>
        </div>
      </form>
    </div>
  );
}

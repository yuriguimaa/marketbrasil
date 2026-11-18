/**
 * Login opcional (Supabase Auth). O site continua aberto sem conta; o login só
 * serve para guardar a carteira na nuvem. A biblioteca do Supabase só é baixada
 * quando a pessoa já tem sessão, volta de um link de e-mail ou abre a tela de login.
 */
import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const authEnabled = !!(URL_ && KEY);

export interface AuthUser { id: string; email?: string }
interface AuthState { ready: boolean; user: AuthUser | null; recovery: boolean }

let state: AuthState = { ready: !authEnabled, user: null, recovery: false };
const listeners = new Set<() => void>();
const emit = (p: Partial<AuthState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useAuth(): AuthState { return useSyncExternalStore(subscribe, () => state); }
export const getAuth = () => state;
export const onAuth = subscribe;

let clientP: Promise<SupabaseClient> | null = null;

export function getClient(): Promise<SupabaseClient> {
  if (!authEnabled) return Promise.reject(new Error('O login não está configurado neste site.'));
  return (clientP ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const c = createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    c.auth.onAuthStateChange((ev, session) => {
      const u = session?.user;
      const same = state.user?.id === u?.id;
      emit({
        ready: true,
        user: u ? (same && state.user ? state.user : { id: u.id, email: u.email }) : null,
        recovery: ev === 'PASSWORD_RECOVERY' ? true : ev === 'SIGNED_OUT' ? false : state.recovery,
      });
    });
    return c;
  }).catch((e) => { clientP = null; emit({ ready: true }); throw e; }));
}

/** Só carrega o Supabase se já houver sessão salva ou se a URL vier de um link de e-mail. */
export function startAuth() {
  if (!authEnabled) return;
  let hasSession = false;
  try {
    const ref = new URL(URL_!).hostname.split('.')[0];
    hasSession = !!localStorage.getItem(`sb-${ref}-auth-token`);
  } catch { /* sem storage */ }
  const fromEmail = /access_token=|error_description=|type=recovery/.test(location.hash) || /[?&]code=/.test(location.search);
  if (hasSession || fromEmail) void getClient().catch(() => {});
  else emit({ ready: true });
}

const MSG: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
  [/already registered|already been registered/i, 'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci a senha".'],
  [/rate limit|too many/i, 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'],
  [/password should be at least|weak password/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/should be different from the old/i, 'A nova senha precisa ser diferente da atual.'],
  [/invalid.*email|unable to validate email/i, 'Informe um e-mail válido.'],
  [/failed to fetch|network/i, 'Sem conexão com o servidor de login. Verifique a internet e tente de novo.'],
];
export function authMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return MSG.find(([re]) => re.test(m))?.[1] ?? 'Não foi possível concluir agora. Tente de novo em instantes.';
}

const check = <T extends { error: unknown }>(r: T) => { if (r.error) throw r.error; return r; };

export async function signIn(email: string, password: string) {
  const c = await getClient();
  check(await c.auth.signInWithPassword({ email, password }));
}

/** Retorna true quando a conta precisa de confirmação por e-mail. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const c = await getClient();
  const r = check(await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/carteira' } }));
  // conta já existente com e-mail confirmado: o Supabase devolve usuário sem identidades
  if (r.data.user && !r.data.user.identities?.length) throw new Error('already registered');
  return !r.data.session;
}

export async function sendReset(email: string) {
  const c = await getClient();
  check(await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/entrar' }));
}

export async function updatePassword(password: string) {
  const c = await getClient();
  check(await c.auth.updateUser({ password }));
  emit({ recovery: false });
}

export async function signOut() {
  const c = await getClient();
  await c.auth.signOut();
  emit({ user: null, recovery: false });
}

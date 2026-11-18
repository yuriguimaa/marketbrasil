-- Carteira de cada cliente. RLS: cada pessoa só lê e altera as próprias linhas.
create table public.portfolio_transactions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,20}$'),
  side text not null check (side in ('buy','sell')),
  qty numeric not null check (qty > 0),
  price numeric not null check (price > 0),
  fees numeric not null default 0 check (fees >= 0),
  trade_date date not null,
  source text not null default 'manual' check (source in ('manual','b3','local')),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.portfolio_transactions enable row level security;

create policy "dono lê" on public.portfolio_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono insere" on public.portfolio_transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.portfolio_transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.portfolio_transactions for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.portfolio_transactions from anon;
grant select, insert, update, delete on public.portfolio_transactions to authenticated;

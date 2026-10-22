-- Connectra: Google connection storage (docs/DECISIONS.md D-006, D-007).
-- Run once in the Supabase SQL Editor. Safe to re-run: it stops if the table already exists.
--
-- One row per user. Every value from Google is stored encrypted by the app
-- (AES-256-GCM, format "v1.<iv>.<tag>.<ciphertext>"), never in readable form.
-- Deleting the user in auth.users deletes the row (on delete cascade).

create table public.google_connections (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  refresh_token_enc  text not null,
  google_email_enc   text not null,
  google_name_enc    text,
  key_version        smallint not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Row-level security: each signed-in user can reach only their own row.
alter table public.google_connections enable row level security;

revoke all on public.google_connections from anon, authenticated;
grant select, insert, update, delete on public.google_connections to authenticated;

create policy "Users read own connection" on public.google_connections
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own connection" on public.google_connections
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own connection" on public.google_connections
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own connection" on public.google_connections
  for delete to authenticated
  using ((select auth.uid()) = user_id);

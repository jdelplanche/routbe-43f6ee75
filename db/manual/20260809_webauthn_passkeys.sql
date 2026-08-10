-- ============================================================================
-- ROUT — WebAuthn / passkeys
-- Run this in the Supabase SQL editor of project ejscdvocfxbphzgfbwui.
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- 1. Stored credentials -------------------------------------------------------
create table if not exists public.webauthn_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  credential_id   text not null unique,          -- base64url of the raw credential id
  public_key      text not null,                 -- base64url COSE public key
  counter         bigint not null default 0,
  transports      text[] not null default '{}',
  device_label    text,
  backed_up       boolean not null default false,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists webauthn_credentials_user_id_idx
  on public.webauthn_credentials (user_id);

-- Data API access. Reads/deletes are owner-scoped by RLS below; writes happen
-- server-side with the service role, so `authenticated` gets no insert/update.
grant select, delete on public.webauthn_credentials to authenticated;
grant all on public.webauthn_credentials to service_role;

alter table public.webauthn_credentials enable row level security;

drop policy if exists "Users read own passkeys" on public.webauthn_credentials;
create policy "Users read own passkeys"
  on public.webauthn_credentials
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users delete own passkeys" on public.webauthn_credentials;
create policy "Users delete own passkeys"
  on public.webauthn_credentials
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 2. Short-lived challenges ---------------------------------------------------
-- Workers are stateless, so the registration/authentication challenge has to
-- survive the round trip somewhere both halves of the ceremony can reach.
create table if not exists public.webauthn_challenges (
  challenge   text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  purpose     text not null check (purpose in ('registration', 'authentication')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '5 minutes'
);

create index if not exists webauthn_challenges_expires_at_idx
  on public.webauthn_challenges (expires_at);

-- Never reachable from the browser: only the service role touches this table.
revoke all on public.webauthn_challenges from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
grant all on public.webauthn_challenges to service_role;

alter table public.webauthn_challenges enable row level security;
-- Belt and braces: force RLS (so even a table owner is filtered) and add an
-- explicit deny-all policy for anon/authenticated. The service role bypasses
-- RLS entirely, so the server-side ceremony is unaffected.
alter table public.webauthn_challenges force row level security;

drop policy if exists "No client access to challenges" on public.webauthn_challenges;
create policy "No client access to challenges"
  on public.webauthn_challenges
  for all
  to anon, authenticated
  using (false)
  with check (false);


-- 3. Housekeeping -------------------------------------------------------------
create or replace function public.prune_webauthn_challenges()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.webauthn_challenges where expires_at < now();
$$;

revoke all on function public.prune_webauthn_challenges() from public, anon, authenticated;
grant execute on function public.prune_webauthn_challenges() to service_role;

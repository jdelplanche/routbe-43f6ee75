-- ROUT — notification layer, badge activity log, webhook monitoring & profile RLS fix.
-- Purely additive: no table, column, policy or row is dropped.
-- Run once in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. RLS fix: an authenticated member must be able to update their own profile
--    ("permission denied for table profiles" when saving a username).
-- ---------------------------------------------------------------------------
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "Members update their own profile" on public.profiles;
create policy "Members update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Members read their own profile" on public.profiles;
create policy "Members read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. In-app notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  locale text not null default 'nl',
  severity text not null default 'info',
  details jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

drop policy if exists "Members read their own notifications" on public.notifications;
create policy "Members read their own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members mark their own notifications read" on public.notifications;
create policy "Members mark their own notifications read"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Badge activity log (dashboard "Activity" table)
-- ---------------------------------------------------------------------------
create table if not exists public.badge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_slug text not null,
  action text not null,              -- granted | revoked | claimed
  source text,                       -- subscription | sepa | card | refund | referral | admin
  serial_number integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists badge_events_user_created_idx
  on public.badge_events (user_id, created_at desc);

grant select on public.badge_events to authenticated;
grant all on public.badge_events to service_role;

alter table public.badge_events enable row level security;

drop policy if exists "Members read their own badge activity" on public.badge_events;
create policy "Members read their own badge activity"
  on public.badge_events for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Webhook monitoring: keep status, payload and failure detail per event
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id text primary key,
  source text not null,
  kind text,
  created_at timestamptz not null default now()
);

alter table public.webhook_events add column if not exists status text not null default 'received';
alter table public.webhook_events add column if not exists idempotency_key text;
alter table public.webhook_events add column if not exists outcome text;
alter table public.webhook_events add column if not exists error text;
alter table public.webhook_events add column if not exists attempts integer not null default 0;
alter table public.webhook_events add column if not exists payload jsonb;
alter table public.webhook_events add column if not exists processed_at timestamptz;

create index if not exists webhook_events_created_idx on public.webhook_events (created_at desc);

grant all on public.webhook_events to service_role;

alter table public.webhook_events enable row level security;
-- Admin reads go through the service-role server functions; no client policy.

-- ---------------------------------------------------------------------------
-- 5. Referral analytics: one row per visit on rout.be/r/<handle>
-- ---------------------------------------------------------------------------
create table if not exists public.referral_visits (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  inviter_id uuid references auth.users(id) on delete set null,
  converted boolean not null default false,
  referer text,
  created_at timestamptz not null default now()
);

create index if not exists referral_visits_handle_idx on public.referral_visits (handle, created_at desc);
create index if not exists referral_visits_inviter_idx on public.referral_visits (inviter_id, created_at desc);

grant select on public.referral_visits to authenticated;
grant all on public.referral_visits to service_role;

alter table public.referral_visits enable row level security;

drop policy if exists "Members read their own referral visits" on public.referral_visits;
create policy "Members read their own referral visits"
  on public.referral_visits for select to authenticated
  using (auth.uid() = inviter_id);

-- Profile hub analytics: allow link-click events next to profile views.
-- Idempotent: safe to run more than once.
alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events
  add constraint analytics_events_event_type_check
  check (event_type in ('profile_view', 'link_click', 'qr_scan'));

-- Events are written by the server (service role) only; owners read their own.
grant select on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;

alter table public.analytics_events enable row level security;

drop policy if exists "Owners read their own analytics" on public.analytics_events;
create policy "Owners read their own analytics"
  on public.analytics_events for select
  to authenticated
  using (profile_id = auth.uid());

create index if not exists analytics_events_profile_created_idx
  on public.analytics_events (profile_id, created_at desc);

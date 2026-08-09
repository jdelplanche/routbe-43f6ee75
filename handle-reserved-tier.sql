-- ============================================================
-- ROUT — handle reserved tier (Twitter/X style)
-- Run this once in the Supabase SQL Editor.
--   < 3 characters   -> rejected (too short)
--   exactly 3 or 4   -> reserved: only allowed when profiles.handle_grant = 'vip'
--   5 or more        -> open to everyone
-- ============================================================

-- Make sure the grant column exists (no-op if it already does).
alter table public.profiles
  add column if not exists handle_grant text;

create or replace function public.enforce_short_handle_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := lower(coalesce(new.username, ''));
  granted text := lower(coalesce(new.handle_grant, ''));
begin
  if h = '' then
    return new;
  end if;

  if char_length(h) < 3 then
    raise exception 'Handle must be at least 3 characters long.'
      using errcode = '23514';
  end if;

  if char_length(h) <= 4 and granted <> 'vip' then
    raise exception '3- and 4-character handles are reserved. Contact support or enter 5+ characters.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_short_handle_rule() from public;
grant execute on function public.enforce_short_handle_rule()
  to authenticated, anon, service_role;

drop trigger if exists profiles_short_handle_rule on public.profiles;
create trigger profiles_short_handle_rule
  before insert or update of username, handle_grant on public.profiles
  for each row execute function public.enforce_short_handle_rule();

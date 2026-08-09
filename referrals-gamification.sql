-- ROUT — referrals, badge serial numbers and rarity.
-- Run once in the Supabase SQL editor. Idempotent.

-- 1. Profiles: referral graph -------------------------------------------------
alter table public.profiles
  add column if not exists invited_count integer not null default 0,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- 2. Badges: rarity + supply --------------------------------------------------
alter table public.badges
  add column if not exists rarity text not null default 'Common',
  add column if not exists max_supply integer;

do $$ begin
  alter table public.badges
    add constraint badges_rarity_check
    check (rarity in ('Artifact','Common','Uncommon','Rare','Epic'));
exception when duplicate_object then null; end $$;

-- 3. user_badges: serial number + display status ------------------------------
alter table public.user_badges
  add column if not exists serial_number integer,
  add column if not exists status text not null default 'claimed',
  add column if not exists awarded_at timestamptz not null default now();

do $$ begin
  alter table public.user_badges
    add constraint user_badges_status_check
    check (status in ('claimed','displayed','hidden'));
exception when duplicate_object then null; end $$;

create unique index if not exists user_badges_serial_idx
  on public.user_badges (badge_id, serial_number);

-- Serial numbers are handed out in award order and never reused.
create or replace function public.assign_badge_serial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.serial_number is null then
    select coalesce(max(serial_number), 0) + 1
      into new.serial_number
      from public.user_badges
     where badge_id = new.badge_id;
  end if;
  return new;
end;
$$;

drop trigger if exists user_badges_serial on public.user_badges;
create trigger user_badges_serial
  before insert on public.user_badges
  for each row execute function public.assign_badge_serial();

-- Backfill serials for rows granted before this migration.
with ordered as (
  select id, row_number() over (partition by badge_id order by awarded_at, id) as rn
    from public.user_badges
   where serial_number is null
)
update public.user_badges ub
   set serial_number = ordered.rn
  from ordered
 where ub.id = ordered.id;

-- 4. Referral milestone badges ------------------------------------------------
insert into public.badges (slug, name, description, rarity, max_supply)
values
  ('the-sharer', 'The Sharer', 'Invited 3 members to ROUT.', 'Uncommon', null),
  ('the-influencer', 'The Influencer', 'Invited 25 members to ROUT.', 'Rare', null)
on conflict (slug) do update
  set rarity = excluded.rarity,
      description = excluded.description;

-- 5. claim_referral RPC -------------------------------------------------------
-- Binds the caller to an inviter exactly once, bumps the inviter's counter and
-- grants milestone badges. Self-referral and re-binding are silent no-ops.
create or replace function public.claim_referral(p_referrer text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ref  uuid;
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  select id into v_ref
    from public.profiles
   where lower(username) = lower(regexp_replace(p_referrer, '^@', ''))
   limit 1;

  if v_ref is null or v_ref = v_user then
    return false;
  end if;

  -- Only bind when this member has no inviter yet.
  update public.profiles
     set referred_by = v_ref
   where id = v_user
     and referred_by is null;

  if not found then
    return false;
  end if;

  update public.profiles
     set invited_count = coalesce(invited_count, 0) + 1
   where id = v_ref
  returning invited_count into v_count;

  if v_count >= 3 then
    insert into public.user_badges (user_id, badge_id)
    select v_ref, b.id from public.badges b where b.slug = 'the-sharer'
    on conflict do nothing;
  end if;

  if v_count >= 25 then
    insert into public.user_badges (user_id, badge_id)
    select v_ref, b.id from public.badges b where b.slug = 'the-influencer'
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

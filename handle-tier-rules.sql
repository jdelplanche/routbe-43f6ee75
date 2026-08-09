-- ============================================================
-- ROUT — tier-aware handle rules (run once in the SQL editor)
--   free accounts      -> min. 5 characters AND at least one digit
--   verified accounts  -> min. 5 characters, no digit required,
--                         must contain a part of verified_legal_name
--   3–4 characters     -> only with handle_grant = 'vip'
-- Mirrors src/lib/handle-rules.ts + src/lib/legal-name.ts.
-- ============================================================

create or replace function public.enforce_handle_tier_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := lower(coalesce(new.username, ''));
  granted text := lower(coalesce(new.handle_grant, ''));
  is_verified boolean := coalesce(new.verified, false);
  legal text := lower(coalesce(new.verified_legal_name, ''));
  folded text;
  part text;
  matched boolean := false;
begin
  if h = '' then
    return new;
  end if;

  if char_length(h) < 3 then
    raise exception 'Handle must be at least 3 characters long.' using errcode = '23514';
  end if;

  if char_length(h) <= 4 and granted <> 'vip' then
    raise exception '3- and 4-character handles are reserved.' using errcode = '23514';
  end if;

  if not is_verified then
    if char_length(h) < 5 or h !~ '[0-9]' then
      raise exception 'Free handles need at least 5 characters and at least one number.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  -- Verified: the handle must stay traceable to the legal name on file.
  if legal <> '' then
    folded := lower(unaccent_safe(h));
    foreach part in array regexp_split_to_array(lower(unaccent_safe(legal)), '[^a-z0-9]+')
    loop
      if char_length(part) >= 2 and position(part in folded) > 0 then
        matched := true;
      end if;
    end loop;
    if not matched then
      raise exception 'Verified handles must contain part of your legal name.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Accent folding without requiring the unaccent extension.
create or replace function public.unaccent_safe(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    lower(coalesce(value, '')),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  );
$$;

revoke all on function public.enforce_handle_tier_rule() from public;
grant execute on function public.enforce_handle_tier_rule() to authenticated, anon, service_role;
grant execute on function public.unaccent_safe(text) to authenticated, anon, service_role;

drop trigger if exists profiles_short_handle_rule on public.profiles;
drop trigger if exists profiles_handle_tier_rule on public.profiles;
create trigger profiles_handle_tier_rule
  before insert or update of username, handle_grant, verified, verified_legal_name
  on public.profiles
  for each row execute function public.enforce_handle_tier_rule();

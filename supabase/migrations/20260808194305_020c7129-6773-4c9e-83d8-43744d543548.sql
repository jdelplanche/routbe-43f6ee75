REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, tagline, bio, avatar_url, favicon_url,
  theme, card_style, blocks, business_info, tier, status, verified, verified_at,
  subdomain_enabled, redirect_target, bluesky_did, custom_domain,
  show_email_publicly, is_early_believer, is_suspended, is_banned,
  created_at, updated_at
) ON public.profiles TO anon;

CREATE OR REPLACE FUNCTION public.seed_demo_content(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qr_a uuid;
  qr_b uuid;
  d int;
  n int;
BEGIN
  INSERT INTO public.saved_qrs (user_id, name, qr_type, qr_value, config) VALUES
    (_user_id, 'Website', 'url', 'https://example.com',
     '{"fgColor":"#111111","bgColor":"#ffffff","dotStyle":"rounded","margin":4}'::jsonb),
    (_user_id, 'Wifi gasten', 'wifi', 'WIFI:T:WPA;S:Guest;P:welkom123;;',
     '{"fgColor":"#0f3460","bgColor":"#ffffff","dotStyle":"square","margin":4}'::jsonb),
    (_user_id, 'Visitekaartje', 'vcard', 'BEGIN:VCARD\nVERSION:3.0\nFN:Demo\nEND:VCARD',
     '{"fgColor":"#1a1a2e","bgColor":"#f7f7f5","dotStyle":"dots","margin":6}'::jsonb);

  INSERT INTO public.tracked_qrs (user_id, slug, label, target_type, target_url, dashboard_token)
  VALUES (_user_id, 'demo-' || substr(replace(_user_id::text, '-', ''), 1, 8),
          'Campagne poster', 'url', 'https://example.com/poster',
          encode(gen_random_bytes(16), 'hex'))
  RETURNING id INTO qr_a;

  INSERT INTO public.tracked_qrs (user_id, slug, label, target_type, target_url, dashboard_token)
  VALUES (_user_id, 'menu-' || substr(replace(_user_id::text, '-', ''), 1, 8),
          'Menukaart', 'url', 'https://example.com/menu',
          encode(gen_random_bytes(16), 'hex'))
  RETURNING id INTO qr_b;

  FOR d IN 0..13 LOOP
    FOR n IN 1..(2 + ((d * 7) % 6)) LOOP
      INSERT INTO public.qr_scans (tracked_qr_id, country, device, scanned_at)
      VALUES (
        CASE WHEN (d + n) % 3 = 0 THEN qr_b ELSE qr_a END,
        (ARRAY['BE','NL','FR','DE'])[1 + ((d + n) % 4)],
        (ARRAY['mobile','desktop','tablet'])[1 + ((d + n) % 3)],
        now() - (d || ' days')::interval - ((n * 37) || ' minutes')::interval
      );
    END LOOP;
  END LOOP;

  INSERT INTO public.links (profile_id, title, url, position) VALUES
    (_user_id, 'Website', 'https://example.com', 0),
    (_user_id, 'Contact', 'mailto:hello@example.com', 1),
    (_user_id, 'Nieuwsbrief', 'https://example.com/newsletter', 2);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_demo_content(uuid) FROM public, anon, authenticated;

ALTER TABLE public.reserved_handles
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.reserved_handles (handle, label, reason)
SELECT h, initcap(h), 'system'
FROM unnest(ARRAY[
  'admin','administrator','api','app','apps','auth','batch','billing','blog','card','claim',
  'contact','dashboard','docs','free','go','help','hub','index','login','logout','mail','me',
  'null','nl','en','fr','de','payment','payments','privacy','profile','root','rout','security',
  'settings','signup','sovereignty','stats','status','studio','support','system','terms','test',
  'undefined','user','users','verify','webhook','webhooks','well-known','www'
]) AS h
ON CONFLICT (handle) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_unique_handle(_seed text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
BEGIN
  base := lower(coalesce(split_part(coalesce(_seed, ''), '@', 1), ''));
  base := regexp_replace(base, '[^a-z0-9-]', '-', 'g');
  base := regexp_replace(base, '-+', '-', 'g');
  base := trim(both '-' from base);
  IF base IS NULL OR length(base) = 0 THEN
    base := 'rout';
  END IF;
  IF length(base) < 5 THEN
    base := base || substr(md5(base || clock_timestamp()::text), 1, 5 - length(base));
  END IF;
  base := left(base, 24);

  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate)
          AND NOT EXISTS (SELECT 1 FROM public.reserved_handles WHERE handle = candidate);
    i := i + 1;
    candidate := left(base, 24) || '-' || i::text;
    IF i > 500 THEN
      candidate := 'rout-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      EXIT;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_admins INT;
  new_handle text;
BEGIN
  new_handle := public.generate_unique_handle(
    coalesce(NEW.raw_user_meta_data->>'username', NEW.email, NEW.id::text)
  );

  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    new_handle
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing_admins FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing_admins = 0 THEN 'admin'::app_role ELSE 'user'::app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  BEGIN
    PERFORM public.seed_demo_content(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

UPDATE public.profiles p
SET username = public.generate_unique_handle(p.id::text)
WHERE p.username IS NULL;

CREATE TABLE IF NOT EXISTS public.showcase_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  display_name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  theme text NOT NULL DEFAULT 'paper',
  link_count integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.showcase_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.showcase_profiles TO authenticated;
GRANT ALL ON public.showcase_profiles TO service_role;

ALTER TABLE public.showcase_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Showcase profiles are public"
  ON public.showcase_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage showcase profiles"
  ON public.showcase_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER showcase_profiles_set_updated_at
  BEFORE UPDATE ON public.showcase_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.showcase_profiles (handle, display_name, tagline, bio, theme, link_count, verified, sort_order) VALUES
  ('studio-noir', 'Studio Noir', 'Grafisch atelier · Gent', 'Print, identiteit en verpakking. Elke QR-code vertrekt hier als vector.', 'paper', 6, true, 1),
  ('cafe-mira', 'Café Mira', 'Koffie & kleine keuken', 'Menukaart, reservaties en playlist achter één code op tafel.', 'pastel', 4, false, 2),
  ('lena-vermeer', 'Lena Vermeer', 'Fotografe', 'Portfolio, prints en contact — zonder tracking, zonder tussenpersoon.', 'midnight', 5, true, 3),
  ('velo-repair', 'Velo Repair', 'Fietsherstel op afspraak', 'Afsprakenlink, openingsuren en route, gebundeld in één profiel.', 'forest', 3, false, 4)
ON CONFLICT (handle) DO NOTHING;

REVOKE ALL ON FUNCTION public.generate_unique_handle(text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.seed_demo_content(uuid) FROM anon, authenticated, public;

REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id, username, display_name, tagline, bio, avatar_url, favicon_url, theme, card_style,
  blocks, business_info, tier, status, verified, verified_at, is_early_believer,
  is_suspended, is_banned, subdomain_enabled, redirect_target, show_email_publicly,
  custom_domain, bluesky_did, created_at, updated_at
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_short_handle_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text := lower(coalesce(new.username, ''));
  granted text := lower(coalesce(new.handle_grant, ''));
BEGIN
  IF h = '' THEN
    RETURN new;
  END IF;

  IF char_length(h) < 3 THEN
    RAISE EXCEPTION 'Handle must be at least 3 characters long.' USING errcode = '23514';
  END IF;

  IF char_length(h) <= 4 AND granted <> 'vip' THEN
    RAISE EXCEPTION '3- and 4-character handles are reserved. Contact support or enter 5+ characters.' USING errcode = '23514';
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_short_handle_rule() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_short_handle_rule ON public.profiles;
CREATE TRIGGER profiles_short_handle_rule
  BEFORE INSERT OR UPDATE OF username, handle_grant ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_short_handle_rule();
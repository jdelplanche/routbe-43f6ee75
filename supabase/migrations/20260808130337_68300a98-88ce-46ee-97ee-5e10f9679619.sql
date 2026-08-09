-- 1. Reserved handles: label + reason, plus the full system list the app blocks.
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

-- 2. Deterministic, collision-free handle generation.
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

-- 3. Signup now also claims a handle for the new profile.
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

-- Backfill any existing profile that never got a handle.
UPDATE public.profiles p
SET username = public.generate_unique_handle(p.id::text)
WHERE p.username IS NULL;

-- 4. Demo/example profiles so profile lists render with realistic content.
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
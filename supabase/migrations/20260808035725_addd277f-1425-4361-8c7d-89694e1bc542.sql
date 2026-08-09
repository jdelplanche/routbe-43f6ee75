CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  tagline text,
  avatar_url text,
  favicon_url text,
  theme text NOT NULL DEFAULT 'paper',
  card_style text NOT NULL DEFAULT 'soft',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  tier text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  subdomain_enabled boolean NOT NULL DEFAULT false,
  redirect_target text NOT NULL DEFAULT 'rout_profile',
  bluesky_did text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT (id, username, display_name, tagline, avatar_url, theme, card_style, blocks, tier, verified, status) ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly viewable" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.saved_qrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  qr_type text NOT NULL,
  qr_value text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_qrs TO authenticated;
GRANT ALL ON public.saved_qrs TO service_role;
ALTER TABLE public.saved_qrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved qrs" ON public.saved_qrs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tracked_qrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  slug text NOT NULL UNIQUE,
  label text,
  target_type text NOT NULL,
  target_url text NOT NULL,
  custom_domain text,
  dashboard_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_qrs TO authenticated;
GRANT ALL ON public.tracked_qrs TO service_role;
ALTER TABLE public.tracked_qrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tracked qrs" ON public.tracked_qrs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_qr_id uuid NOT NULL REFERENCES public.tracked_qrs(id) ON DELETE CASCADE,
  country text,
  device text,
  user_agent text,
  scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_scans_tracked_qr_id_idx ON public.qr_scans(tracked_qr_id);
GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_scans TO service_role;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view scans of own qrs" ON public.qr_scans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tracked_qrs t WHERE t.id = qr_scans.tracked_qr_id AND t.user_id = auth.uid()));

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  rate_limit integer NOT NULL DEFAULT 60,
  request_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own api keys" ON public.api_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  verification_token text NOT NULL,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated;
GRANT ALL ON public.custom_domains TO service_role;
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own domains" ON public.custom_domains FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.verification_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  provider text NOT NULL DEFAULT 'mollie',
  provider_ref text,
  status text NOT NULL DEFAULT 'pending',
  reference_code text,
  donation_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_payments_reference_code_idx ON public.verification_payments (reference_code);
GRANT SELECT ON public.verification_payments TO authenticated;
GRANT ALL ON public.verification_payments TO service_role;
ALTER TABLE public.verification_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.verification_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.reserved_handles (
  handle text PRIMARY KEY
);
GRANT SELECT ON public.reserved_handles TO anon, authenticated;
GRANT ALL ON public.reserved_handles TO service_role;
ALTER TABLE public.reserved_handles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reserved handles are public" ON public.reserved_handles FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.reserved_handles(handle) VALUES
 ('admin'),('api'),('app'),('auth'),('dashboard'),('studio'),('settings'),('developer'),('free'),('go'),('card'),('batch'),('www'),('support'),('help'),('rout'),('login'),('signup'),('en'),('nl');

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.webhook_events (
  id text PRIMARY KEY,
  source text NOT NULL,
  kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.upload_rate_limits (
  client_ip text PRIMARY KEY,
  upload_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.upload_rate_limits TO service_role;
ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER saved_qrs_set_updated_at BEFORE UPDATE ON public.saved_qrs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tracked_qrs_set_updated_at BEFORE UPDATE ON public.tracked_qrs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER api_keys_set_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER custom_domains_set_updated_at BEFORE UPDATE ON public.custom_domains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER verification_payments_set_updated_at BEFORE UPDATE ON public.verification_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all payments" ON public.verification_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_early_believer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS forwarding_email TEXT,
  ADD COLUMN IF NOT EXISTS show_email_publicly BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alias_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.verification_payments
  ADD COLUMN IF NOT EXISTS donation_plan TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Links are publicly viewable"
  ON public.links FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users manage own links"
  ON public.links FOR ALL TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE TRIGGER links_set_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS links_profile_position_idx
  ON public.links (profile_id, position);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('profile_view', 'qr_scan')),
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop')),
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO anon;
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record an event"
  ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owners read own analytics"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);
CREATE INDEX IF NOT EXISTS analytics_events_profile_idx
  ON public.analytics_events (profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_admins INT;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing_admins FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing_admins = 0 THEN 'admin'::app_role ELSE 'user'::app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $function$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

INSERT INTO public.verification_payments
  (user_id, tier, amount_cents, currency, provider, status, reference_code, donation_cents, donation_plan)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'early_believer', 399, 'EUR', 'sepa', 'pending', 'ROUT-DEMO1', 0, 'none'),
  ('00000000-0000-4000-8000-000000000002', 'early_believer', 499, 'EUR', 'sepa', 'paid', 'ROUT-DEMO2', 100, 'monthly'),
  ('00000000-0000-4000-8000-000000000003', 'early_believer', 399, 'EUR', 'sepa', 'failed', 'ROUT-DEMO3', 0, 'none');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS handle_grant text;

GRANT SELECT (is_suspended, is_banned) ON public.profiles TO anon;
GRANT SELECT (is_suspended, is_banned) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_short_handle_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT NULL
     AND char_length(NEW.username) BETWEEN 1 AND 4
     AND coalesce(NEW.handle_grant, '') <> 'vip' THEN
    RAISE EXCEPTION 'short_handle_reserved: handles of 4 characters or fewer require an admin VIP grant';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_short_handle_rule ON public.profiles;
CREATE TRIGGER profiles_short_handle_rule
  BEFORE INSERT OR UPDATE OF username, handle_grant ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_short_handle_rule();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS alias_sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS alias_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alias_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS alias_sync_error text;

CREATE TABLE IF NOT EXISTS public.alias_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alias_sync_jobs TO authenticated;
GRANT ALL ON public.alias_sync_jobs TO service_role;
ALTER TABLE public.alias_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read alias sync jobs"
  ON public.alias_sync_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER alias_sync_jobs_set_updated_at
  BEFORE UPDATE ON public.alias_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS alias_sync_jobs_status_idx ON public.alias_sync_jobs (status, created_at);

CREATE OR REPLACE FUNCTION public.queue_alias_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS DISTINCT FROM true) THEN
    INSERT INTO public.alias_sync_jobs (user_id, action, payload, max_attempts)
    VALUES (NEW.id, 'provision', '{}'::jsonb, 3);

    NEW.alias_sync_status := 'pending';
    NEW.alias_sync_attempts := 0;
    NEW.alias_sync_error := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_alias_on_paid ON public.profiles;
CREATE TRIGGER trg_queue_alias_on_paid
  BEFORE UPDATE OF is_paid ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_alias_on_paid();

REVOKE ALL ON FUNCTION public.queue_alias_on_paid() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_alias_on_paid() FROM anon;
REVOKE ALL ON FUNCTION public.queue_alias_on_paid() FROM authenticated;

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'award',
  color text NOT NULL DEFAULT '#111111',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon;
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Badges are public" ON public.badges;
CREATE POLICY "Badges are public" ON public.badges FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid,
  UNIQUE (user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS user_badges_user_id_idx ON public.user_badges (user_id);
GRANT SELECT ON public.user_badges TO anon;
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Unlocked badges are public" ON public.user_badges;
CREATE POLICY "Unlocked badges are public" ON public.user_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage badge grants" ON public.user_badges;
CREATE POLICY "Admins manage badge grants" ON public.user_badges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.badges (slug, name, description, icon, color, sort_order) VALUES
  ('early_believer', 'Early Believer', 'Backed ROUT with a lifetime verification.', 'badge-check', '#111111', 10),
  ('verified',       'Verified',       'Identity verified on the paid namespace.',   'shield-check', '#111111', 20),
  ('founder',        'Founder',        'Part of the founding ROUT crew.',            'crown',        '#111111', 30),
  ('supporter',      'Supporter',      'Keeps ROUT alive with a recurring donation.','heart',        '#111111', 40),
  ('bluesky',        'Bluesky Verified','Handle verified through AT Protocol.',      'at-sign',      '#111111', 50)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_admin_role_for_owner_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF lower(NEW.email) = 'jona.delplanche@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_admin_role_for_owner_email();

DROP TRIGGER IF EXISTS on_auth_user_email_updated_grant_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_email_updated_grant_owner_admin
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (lower(OLD.email) IS DISTINCT FROM lower(NEW.email))
  EXECUTE FUNCTION public.grant_admin_role_for_owner_email();

DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE lower(email) = 'jona.delplanche@gmail.com' LIMIT 1;
  IF owner_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (owner_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.grant_admin_role_for_owner_email() FROM PUBLIC, anon, authenticated;
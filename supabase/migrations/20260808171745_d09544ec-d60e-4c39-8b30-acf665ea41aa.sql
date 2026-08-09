-- ROUT complete schema for empty database (v3)
-- This is the full rout-complete-empty-database-v3.sql content
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
  handle_grant text,
  forwarding_email text,
  show_email_publicly boolean NOT NULL DEFAULT false,
  is_early_believer boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT false,
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
CREATE POLICY "Anyone can view active tracked qrs" ON public.tracked_qrs FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE TABLE public.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_qr_id uuid REFERENCES public.tracked_qrs(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  referer text,
  country text
);
GRANT SELECT, INSERT ON public.qr_scans TO authenticated;
GRANT INSERT ON public.qr_scans TO anon;
GRANT ALL ON public.qr_scans TO service_role;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log scans" ON public.qr_scans FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owners can view own scans" ON public.qr_scans FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tracked_qrs WHERE id = qr_scans.tracked_qr_id AND user_id = auth.uid())
);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_hash text NOT NULL UNIQUE,
  label text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
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
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated;
GRANT ALL ON public.custom_domains TO service_role;
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own custom domains" ON public.custom_domains FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.verification_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_payments TO authenticated;
GRANT ALL ON public.verification_payments TO service_role;
ALTER TABLE public.verification_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own verification payments" ON public.verification_payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.reserved_handles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reserved_handles TO authenticated;
GRANT ALL ON public.reserved_handles TO service_role;
ALTER TABLE public.reserved_handles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reserved handles are viewable by authenticated users" ON public.reserved_handles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own security events" ON public.security_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own security events" ON public.security_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.upload_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  upload_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.upload_rate_limits TO authenticated;
GRANT ALL ON public.upload_rate_limits TO service_role;
ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rate limits" ON public.upload_rate_limits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User roles table (separate from profiles, security definer pattern)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.links TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Links are publicly viewable" ON public.links FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners manage own links" ON public.links FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile_id AND id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile_id AND id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  visitor_id text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log analytics events" ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owners can view own analytics" ON public.analytics_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = analytics_events.profile_id AND id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.alias_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_handle text NOT NULL,
  target_handle text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alias_sync_jobs TO authenticated;
GRANT ALL ON public.alias_sync_jobs TO service_role;
ALTER TABLE public.alias_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alias sync jobs" ON public.alias_sync_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are publicly viewable" ON public.badges FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User badges are publicly viewable" ON public.user_badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users manage own badges" ON public.user_badges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.showcase_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  featured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.showcase_profiles TO anon, authenticated;
GRANT ALL ON public.showcase_profiles TO service_role;
ALTER TABLE public.showcase_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Showcase profiles are publicly viewable" ON public.showcase_profiles FOR SELECT TO anon, authenticated USING (true);

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_saved_qrs_updated_at BEFORE UPDATE ON public.saved_qrs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tracked_qrs_updated_at BEFORE UPDATE ON public.tracked_qrs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alias_sync_jobs_updated_at BEFORE UPDATE ON public.alias_sync_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- get_my_profile function
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  tagline text,
  avatar_url text,
  favicon_url text,
  theme text,
  card_style text,
  blocks jsonb,
  business_info jsonb,
  tier text,
  status text,
  verified boolean,
  verified_at timestamptz,
  subdomain_enabled boolean,
  redirect_target text,
  bluesky_did text,
  handle_grant text,
  forwarding_email text,
  show_email_publicly boolean,
  is_early_believer boolean,
  is_paid boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Short handle reservation trigger
CREATE OR REPLACE FUNCTION public.enforce_short_handle_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.enforce_short_handle_rule() FROM public;
GRANT EXECUTE ON FUNCTION public.enforce_short_handle_rule() TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS profiles_short_handle_rule ON public.profiles;
CREATE TRIGGER profiles_short_handle_rule
  BEFORE INSERT OR UPDATE OF username, handle_grant ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_short_handle_rule();
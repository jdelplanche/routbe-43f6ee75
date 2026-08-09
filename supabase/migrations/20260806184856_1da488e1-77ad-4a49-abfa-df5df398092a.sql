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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Roles live in their own table (never on profiles) to prevent privilege escalation.
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

-- Audit trail of every administrative action taken in /admin.
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
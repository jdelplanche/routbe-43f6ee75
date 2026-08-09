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

INSERT INTO public.verification_payments
  (user_id, tier, amount_cents, currency, provider, status, reference_code, donation_cents, donation_plan)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'early_believer', 399, 'EUR', 'sepa', 'pending', 'ROUT-DEMO1', 0, 'none'),
  ('00000000-0000-4000-8000-000000000002', 'early_believer', 499, 'EUR', 'sepa', 'paid', 'ROUT-DEMO2', 100, 'monthly'),
  ('00000000-0000-4000-8000-000000000003', 'early_believer', 399, 'EUR', 'sepa', 'failed', 'ROUT-DEMO3', 0, 'none');
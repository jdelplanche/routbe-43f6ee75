-- 1. Entitlement helper -------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_entitled_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND (p.is_paid = true OR p.verified = true OR p.is_early_believer = true)
      AND p.status = 'active'
      AND p.is_banned IS NOT TRUE
      AND p.is_suspended IS NOT TRUE
  )
$$;

REVOKE ALL ON FUNCTION public.is_entitled_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_entitled_member(uuid) TO authenticated, service_role;

-- 2. Column-level write privileges on profiles ---------------------------
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;

GRANT INSERT (
  id, username, display_name, tagline, bio, avatar_url, favicon_url,
  theme, card_style, blocks, business_info,
  subdomain_enabled, redirect_target, bluesky_did,
  forwarding_email, show_email_publicly
) ON public.profiles TO authenticated;

GRANT UPDATE (
  username, display_name, tagline, bio, avatar_url, favicon_url,
  theme, card_style, blocks, business_info,
  subdomain_enabled, redirect_target, bluesky_did,
  forwarding_email, show_email_publicly
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

-- 3. Entitlement gate on premium profile fields --------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_premium_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched boolean := false;
BEGIN
  -- Only enforce for ordinary signed-in callers; service_role / admin paths
  -- and database-internal writes are exempt.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    touched := COALESCE(NEW.subdomain_enabled, false)
            OR NEW.bluesky_did IS NOT NULL
            OR COALESCE(NEW.redirect_target, 'rout_profile') <> 'rout_profile'
            OR NEW.forwarding_email IS NOT NULL
            OR NEW.custom_domain IS NOT NULL;
  ELSE
    touched := (NEW.subdomain_enabled IS DISTINCT FROM OLD.subdomain_enabled AND COALESCE(NEW.subdomain_enabled, false))
            OR (NEW.bluesky_did IS DISTINCT FROM OLD.bluesky_did AND NEW.bluesky_did IS NOT NULL)
            OR (NEW.redirect_target IS DISTINCT FROM OLD.redirect_target AND NEW.redirect_target <> 'rout_profile')
            OR (NEW.forwarding_email IS DISTINCT FROM OLD.forwarding_email AND NEW.forwarding_email IS NOT NULL)
            OR (NEW.custom_domain IS DISTINCT FROM OLD.custom_domain AND NEW.custom_domain IS NOT NULL);
  END IF;

  IF touched AND NOT public.is_entitled_member(NEW.id) THEN
    RAISE EXCEPTION 'Subdomain, Bluesky and e-mail forwarding settings require an active Early Believer or verified account.'
      USING errcode = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_premium_fields_gate ON public.profiles;
CREATE TRIGGER profiles_premium_fields_gate
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_premium_fields();

-- 4. Custom domains are entitled-members only ----------------------------
CREATE OR REPLACE FUNCTION public.enforce_custom_domain_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_entitled_member(NEW.user_id) THEN
    RAISE EXCEPTION 'Custom domains require an active Early Believer or verified account.'
      USING errcode = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_domains_entitlement_gate ON public.custom_domains;
CREATE TRIGGER custom_domains_entitlement_gate
BEFORE INSERT OR UPDATE ON public.custom_domains
FOR EACH ROW EXECUTE FUNCTION public.enforce_custom_domain_entitlement();

-- 5. Anonymous visitors get no write access to premium surfaces ----------
REVOKE INSERT, UPDATE, DELETE ON public.custom_domains FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.verification_payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.alias_sync_jobs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.qr_scans FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.badges FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reserved_handles FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.analytics_events FROM anon, authenticated;
-- Authenticated users could read EVERY column of EVERY profile (forwarding_email,
-- is_paid, payment_method, moderation notes...). Narrow it to the same public
-- column set anon already has; owners read their private fields via an RPC.
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
REVOKE ALL ON FUNCTION public.enforce_profile_premium_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_custom_domain_entitlement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_profile_premium_fields() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_custom_domain_entitlement() TO service_role;
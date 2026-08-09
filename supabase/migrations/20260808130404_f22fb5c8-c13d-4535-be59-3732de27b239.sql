REVOKE ALL ON FUNCTION public.generate_unique_handle(text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.seed_demo_content(uuid) FROM anon, authenticated, public;
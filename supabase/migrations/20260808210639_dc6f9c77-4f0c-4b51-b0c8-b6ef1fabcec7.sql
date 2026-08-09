ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_legal_name text,
  ADD COLUMN IF NOT EXISTS forwarding_email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarding_email_token text,
  ADD COLUMN IF NOT EXISTS forwarding_email_token_expires_at timestamptz;

REVOKE UPDATE (verified_legal_name, forwarding_email_verified, forwarding_email_token, forwarding_email_token_expires_at) ON public.profiles FROM authenticated;
REVOKE SELECT (forwarding_email_token) ON public.profiles FROM authenticated, anon;

GRANT ALL ON public.profiles TO service_role;
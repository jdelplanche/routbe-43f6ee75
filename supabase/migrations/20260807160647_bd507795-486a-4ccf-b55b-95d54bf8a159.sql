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

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);
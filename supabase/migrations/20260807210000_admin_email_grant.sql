-- Automatic admin role for the platform owner account.
-- jona.delplanche@gmail.com is granted the admin role on sign-up and whenever
-- the e-mail address is confirmed or updated. This keeps the production owner
-- admin even if the database is re-provisioned.

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

-- Apply on insert and on e-mail confirmation / update.
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

-- Backfill for any existing auth user that already uses the owner e-mail.
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

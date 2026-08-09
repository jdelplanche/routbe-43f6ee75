-- Automatic @rout.be alias activation: when a profile flips to paid, queue the
-- ImprovMX provision job and mark the profile as pending sync. No admin action.
CREATE OR REPLACE FUNCTION public.queue_alias_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS DISTINCT FROM true) THEN
    INSERT INTO public.alias_sync_jobs (user_id, action, payload, max_attempts)
    VALUES (NEW.id, 'provision', '{}'::jsonb, 3);

    NEW.alias_sync_status := 'pending';
    NEW.alias_sync_attempts := 0;
    NEW.alias_sync_error := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_alias_on_paid ON public.profiles;
CREATE TRIGGER trg_queue_alias_on_paid
  BEFORE UPDATE OF is_paid ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_alias_on_paid();
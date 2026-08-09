ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS alias_sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS alias_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alias_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS alias_sync_error text;

UPDATE public.profiles p
SET is_paid = true
WHERE p.verified = true
   OR EXISTS (SELECT 1 FROM public.verification_payments v WHERE v.user_id = p.id AND v.status = 'paid');

CREATE TABLE IF NOT EXISTS public.alias_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.alias_sync_jobs TO authenticated;
GRANT ALL ON public.alias_sync_jobs TO service_role;

ALTER TABLE public.alias_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alias sync jobs"
  ON public.alias_sync_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER alias_sync_jobs_set_updated_at
  BEFORE UPDATE ON public.alias_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS alias_sync_jobs_status_idx ON public.alias_sync_jobs (status, created_at);
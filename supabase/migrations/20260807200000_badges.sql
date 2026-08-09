-- ROUT badges system: catalogue + per-user unlocks.

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'award',
  color text NOT NULL DEFAULT '#111111',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.badges TO anon;
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges are public" ON public.badges;
CREATE POLICY "Badges are public" ON public.badges FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid,
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_id_idx ON public.user_badges (user_id);

GRANT SELECT ON public.user_badges TO anon;
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Unlocked badges are public" ON public.user_badges;
CREATE POLICY "Unlocked badges are public" ON public.user_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage badge grants" ON public.user_badges;
CREATE POLICY "Admins manage badge grants" ON public.user_badges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.badges (slug, name, description, icon, color, sort_order) VALUES
  ('early_believer', 'Early Believer', 'Backed ROUT with a lifetime verification.', 'badge-check', '#111111', 10),
  ('verified',       'Verified',       'Identity verified on the paid namespace.',   'shield-check', '#111111', 20),
  ('founder',        'Founder',        'Part of the founding ROUT crew.',            'crown',        '#111111', 30),
  ('supporter',      'Supporter',      'Keeps ROUT alive with a recurring donation.','heart',        '#111111', 40),
  ('bluesky',        'Bluesky Verified','Handle verified through AT Protocol.',      'at-sign',      '#111111', 50)
ON CONFLICT (slug) DO NOTHING;

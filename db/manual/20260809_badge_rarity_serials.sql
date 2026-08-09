-- ROUT — badge rarity, capped supply and unique serial numbers.
-- Run this once in the Supabase SQL editor of the rout.be project.
-- Additive only: existing badges and grants stay untouched.

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS max_supply integer;

ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_rarity_check;
ALTER TABLE public.badges ADD CONSTRAINT badges_rarity_check
  CHECK (rarity IN ('artifact', 'common', 'uncommon', 'rare', 'epic'));

ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS serial_number integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'displayed';

ALTER TABLE public.user_badges DROP CONSTRAINT IF EXISTS user_badges_status_check;
ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_status_check
  CHECK (status IN ('claimed', 'displayed', 'hidden'));

-- Serials are per badge: #12 of one badge, #45583 of another.
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_serial_unique
  ON public.user_badges (badge_id, serial_number);

-- Backfill in grant order so early supporters keep the low numbers.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY badge_id ORDER BY awarded_at, id) AS seq
  FROM public.user_badges WHERE serial_number IS NULL
)
UPDATE public.user_badges ub SET serial_number = numbered.seq
FROM numbered WHERE ub.id = numbered.id;

-- Assigns the next serial inside the insert; the unique index settles races.
CREATE OR REPLACE FUNCTION public.assign_badge_serial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_serial integer; cap integer;
BEGIN
  IF NEW.serial_number IS NOT NULL THEN RETURN NEW; END IF;
  SELECT coalesce(max(serial_number), 0) + 1 INTO next_serial
    FROM public.user_badges WHERE badge_id = NEW.badge_id;
  SELECT max_supply INTO cap FROM public.badges WHERE id = NEW.badge_id;
  IF cap IS NOT NULL AND next_serial > cap THEN
    RAISE EXCEPTION 'badge % is sold out (max supply %)', NEW.badge_id, cap;
  END IF;
  NEW.serial_number := next_serial;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS user_badges_assign_serial ON public.user_badges;
CREATE TRIGGER user_badges_assign_serial
  BEFORE INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.assign_badge_serial();

UPDATE public.badges SET rarity = 'artifact', max_supply = 50000 WHERE slug = 'early_believer';
UPDATE public.badges SET rarity = 'common'                        WHERE slug = 'verified';
UPDATE public.badges SET rarity = 'epic', max_supply = 100        WHERE slug = 'founder';
UPDATE public.badges SET rarity = 'rare'                          WHERE slug = 'supporter';
UPDATE public.badges SET rarity = 'uncommon'                      WHERE slug = 'bluesky';

-- Referral milestones, driven by profiles.invited_count.
INSERT INTO public.badges (slug, name, description, icon, color, sort_order, rarity, max_supply) VALUES
  ('sharer',     'The Sharer',     'Invited 3 people to ROUT.',   'share-2',  '#111111', 60, 'uncommon', NULL),
  ('connector',  'The Connector',  'Invited 10 people to ROUT.',  'users',    '#111111', 70, 'rare',     NULL),
  ('influencer', 'The Influencer', 'Invited 50 people to ROUT.',  'megaphone','#111111', 80, 'epic',     NULL)
ON CONFLICT (slug) DO NOTHING;

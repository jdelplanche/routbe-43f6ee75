-- 1. Anonymous visitors may only read public profile columns.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, tagline, bio, avatar_url, favicon_url,
  theme, card_style, blocks, business_info, tier, status, verified, verified_at,
  subdomain_enabled, redirect_target, bluesky_did, custom_domain,
  show_email_publicly, is_early_believer, is_suspended, is_banned,
  created_at, updated_at
) ON public.profiles TO anon;

-- 2. Seed a realistic starter dashboard for every brand-new account.
CREATE OR REPLACE FUNCTION public.seed_demo_content(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qr_a uuid;
  qr_b uuid;
  d int;
  n int;
BEGIN
  INSERT INTO public.saved_qrs (user_id, name, qr_type, qr_value, config) VALUES
    (_user_id, 'Website', 'url', 'https://example.com',
     '{"fgColor":"#111111","bgColor":"#ffffff","dotStyle":"rounded","margin":4}'::jsonb),
    (_user_id, 'Wifi gasten', 'wifi', 'WIFI:T:WPA;S:Guest;P:welkom123;;',
     '{"fgColor":"#0f3460","bgColor":"#ffffff","dotStyle":"square","margin":4}'::jsonb),
    (_user_id, 'Visitekaartje', 'vcard', 'BEGIN:VCARD\nVERSION:3.0\nFN:Demo\nEND:VCARD',
     '{"fgColor":"#1a1a2e","bgColor":"#f7f7f5","dotStyle":"dots","margin":6}'::jsonb);

  INSERT INTO public.tracked_qrs (user_id, slug, label, target_type, target_url, dashboard_token)
  VALUES (_user_id, 'demo-' || substr(replace(_user_id::text, '-', ''), 1, 8),
          'Campagne poster', 'url', 'https://example.com/poster',
          encode(gen_random_bytes(16), 'hex'))
  RETURNING id INTO qr_a;

  INSERT INTO public.tracked_qrs (user_id, slug, label, target_type, target_url, dashboard_token)
  VALUES (_user_id, 'menu-' || substr(replace(_user_id::text, '-', ''), 1, 8),
          'Menukaart', 'url', 'https://example.com/menu',
          encode(gen_random_bytes(16), 'hex'))
  RETURNING id INTO qr_b;

  -- Two weeks of plausible scan history so charts are not empty.
  FOR d IN 0..13 LOOP
    FOR n IN 1..(2 + ((d * 7) % 6)) LOOP
      INSERT INTO public.qr_scans (tracked_qr_id, country, device, scanned_at)
      VALUES (
        CASE WHEN (d + n) % 3 = 0 THEN qr_b ELSE qr_a END,
        (ARRAY['BE','NL','FR','DE'])[1 + ((d + n) % 4)],
        (ARRAY['mobile','desktop','tablet'])[1 + ((d + n) % 3)],
        now() - (d || ' days')::interval - ((n * 37) || ' minutes')::interval
      );
    END LOOP;
  END LOOP;

  INSERT INTO public.links (profile_id, title, url, position) VALUES
    (_user_id, 'Website', 'https://example.com', 0),
    (_user_id, 'Contact', 'mailto:hello@example.com', 1),
    (_user_id, 'Nieuwsbrief', 'https://example.com/newsletter', 2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_demo_content(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_admins INT;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing_admins FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing_admins = 0 THEN 'admin'::app_role ELSE 'user'::app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  BEGIN
    PERFORM public.seed_demo_content(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Demo content is a nicety; never block account creation on it.
    NULL;
  END;

  RETURN NEW;
END;
$$;
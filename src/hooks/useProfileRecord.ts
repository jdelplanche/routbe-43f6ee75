import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileBlock, ProfileRecord } from "@/lib/profile";

/** Loads a public profile by handle. Returns null when the handle is unclaimed. */
export function useProfileRecord(username: string) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, tagline, avatar_url, theme, card_style, blocks, tier, verified, status, is_suspended, is_early_believer, show_email_publicly, favicon_url, bio, created_at",
        )
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (cancelled) return;
      const row = data as (Record<string, unknown> & { blocks?: unknown }) | null;
      setSuspended(Boolean(row?.["is_suspended"]));
      setProfile(
        row
          ? ({
              ...row,
              blocks: Array.isArray(row.blocks) ? (row.blocks as unknown as ProfileBlock[]) : [],
            } as unknown as ProfileRecord)
          : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  return { profile, suspended, loading };
}

/**
 * Server-side loader for the public link hub (`/handle`, `/@handle`, `/u/handle`).
 *
 * Runs during SSR so crawlers and social scrapers receive fully rendered HTML
 * plus per-profile metadata. Only public columns are ever selected.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ProfileBlock, ProfileRecord } from "@/lib/profile";
import { profileStyleOf } from "@/lib/profile-style";

const PUBLIC_COLUMNS =
  "id, username, display_name, tagline, avatar_url, theme, card_style, blocks, tier, verified, status, is_suspended, is_banned, is_early_believer, show_email_publicly, favicon_url, bio, created_at, business_info";

export interface PublicProfilePayload {
  profile: (ProfileRecord & { style: ReturnType<typeof profileStyleOf> }) | null;
  suspended: boolean;
}

/** Normalises a raw URL segment into a stored handle. */
export function normalizePublicHandle(raw: string): string {
  return decodeURIComponent(raw ?? "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .slice(0, 40);
}

export async function loadPublicProfile(rawHandle: string): Promise<PublicProfilePayload> {
  const handle = normalizePublicHandle(rawHandle);
  if (!handle) return { profile: null, suspended: false };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PUBLIC_COLUMNS)
    .eq("username", handle)
    .maybeSingle();

  if (error) {
    console.error("[public-profile] lookup failed", error);
    return { profile: null, suspended: false };
  }
  if (!data) return { profile: null, suspended: false };

  const row = data as Record<string, unknown>;
  const suspended = Boolean(row["is_suspended"]) || Boolean(row["is_banned"]);
  const { business_info: businessInfo, is_banned: _banned, ...rest } = row;

  return {
    suspended,
    profile: {
      ...(rest as unknown as ProfileRecord),
      blocks: Array.isArray(rest["blocks"]) ? (rest["blocks"] as unknown as ProfileBlock[]) : [],
      style: profileStyleOf(businessInfo),
    },
  };
}

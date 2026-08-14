import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  needsEarlyBelieverBackfill,
  toBaselineStatus,
  toMemberStatus,
  type MemberStatus,
} from "@/lib/membership-rules";

export type { MemberStatus } from "@/lib/membership-rules";

const PROFILE_COLUMNS = "username, verified, is_paid, is_early_believer";

/**
 * Baseline membership: every registered member is an Early Believer with a blue
 * mark, regardless of payment or identity verification. Idempotent, so it is
 * safe to call on every sign-in.
 */
export const ensureMemberBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", context.userId)
      .maybeSingle();

    if (needsEarlyBelieverBackfill(profile)) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_early_believer: true })
        .eq("id", context.userId);
    }

    const { awardBadges } = await import("./badge-grants.server");
    await awardBadges(context.userId, ["early_believer"], "system", { reason: "registration" });

    return toBaselineStatus(profile);
  });

/** Read-only membership snapshot for the signed-in member. */
export const getMemberStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberStatus> => {
    const { data } = await context.supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", context.userId)
      .maybeSingle();

    return toMemberStatus(data);
  });

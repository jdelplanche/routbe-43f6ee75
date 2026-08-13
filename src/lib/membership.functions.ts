import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberStatus = {
  /** Free for every registered member — no payment, no verification. */
  earlyBeliever: boolean;
  /** Blue mark: granted on registration, kept in sync with the profile row. */
  blueMark: boolean;
  /** Identity-verified (legal name on file + paid verification). */
  verified: boolean;
  isPaid: boolean;
  username: string | null;
  /** The member's @rout.be address, once a handle exists. */
  aliasEmail: string | null;
};

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
      .select("username, verified, is_paid, is_early_believer")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.is_early_believer) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_early_believer: true })
        .eq("id", context.userId);
    }

    const { awardBadges } = await import("./badge-grants.server");
    await awardBadges(context.userId, ["early_believer"], "system", { reason: "registration" });

    const username = (profile?.username as string | null) ?? null;
    return {
      earlyBeliever: true,
      blueMark: true,
      verified: Boolean(profile?.verified),
      isPaid: Boolean(profile?.is_paid),
      username,
      aliasEmail: username ? `${username}@rout.be` : null,
    };
  });

/** Read-only membership snapshot for the signed-in member. */
export const getMemberStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberStatus> => {
    const { data } = await context.supabase
      .from("profiles")
      .select("username, verified, is_paid, is_early_believer")
      .eq("id", context.userId)
      .maybeSingle();

    const username = (data?.username as string | null) ?? null;
    return {
      earlyBeliever: Boolean(data?.is_early_believer),
      blueMark: true,
      verified: Boolean(data?.verified),
      isPaid: Boolean(data?.is_paid),
      username,
      aliasEmail: username ? `${username}@rout.be` : null,
    };
  });

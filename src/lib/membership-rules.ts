/**
 * Pure membership rules, shared by the server functions and unit tests.
 *
 * Everyone who registers is an Early Believer and carries the blue mark —
 * no payment, no identity verification. Verification is a separate, optional
 * step that unlocks domains, subdomains and Bluesky.
 */

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

/** The subset of `profiles` membership status is derived from. */
export type MembershipProfileRow = {
  username?: string | null;
  verified?: boolean | null;
  is_paid?: boolean | null;
  is_early_believer?: boolean | null;
} | null;

/** The @rout.be address for a handle, or null when no handle exists yet. */
export function aliasEmailFor(username: string | null | undefined): string | null {
  const handle = (username ?? "").trim();
  return handle ? `${handle}@rout.be` : null;
}

/**
 * Read-only projection of a profile row. A missing or RLS-hidden row must not
 * throw — it degrades to "not an early believer yet", never to a crash.
 */
export function toMemberStatus(profile: MembershipProfileRow): MemberStatus {
  const username = profile?.username ?? null;
  return {
    earlyBeliever: Boolean(profile?.is_early_believer),
    blueMark: true,
    verified: Boolean(profile?.verified),
    isPaid: Boolean(profile?.is_paid),
    username,
    aliasEmail: aliasEmailFor(username),
  };
}

/**
 * Status right after the baseline ran: the member is always an Early Believer,
 * regardless of what the stored row said a moment ago.
 */
export function toBaselineStatus(profile: MembershipProfileRow): MemberStatus {
  return { ...toMemberStatus(profile), earlyBeliever: true };
}

/** True when the profile row still has to be flipped to `is_early_believer`. */
export function needsEarlyBelieverBackfill(profile: MembershipProfileRow): boolean {
  return profile?.is_early_believer !== true;
}

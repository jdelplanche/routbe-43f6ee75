import { describe, expect, it } from "vitest";
import {
  aliasEmailFor,
  applyMemberBaseline,
  needsEarlyBelieverBackfill,
  toBaselineStatus,
  toMemberStatus,
  type MembershipProfileRow,
} from "./membership-rules";

/** In-memory stand-in for the profiles row + badge table. */
function fakeBackend(initial: MembershipProfileRow) {
  const state = {
    profile: initial,
    updates: 0,
    badgeCalls: 0,
    badges: new Set<string>(),
  };
  return {
    state,
    deps: {
      fetchProfile: async () => state.profile,
      markEarlyBeliever: async () => {
        state.updates += 1;
        state.profile = { ...(state.profile ?? {}), is_early_believer: true };
      },
      awardEarlyBelieverBadge: async () => {
        state.badgeCalls += 1;
        state.badges.add("early_believer");
      },
    },
  };
}

describe("toMemberStatus", () => {
  it("gives every member the blue mark, even with an empty profile", () => {
    expect(toMemberStatus(null)).toEqual({
      earlyBeliever: false,
      blueMark: true,
      verified: false,
      isPaid: false,
      username: null,
      aliasEmail: null,
    });
  });

  it("derives the @rout.be alias from the handle", () => {
    expect(toMemberStatus({ username: "jules" }).aliasEmail).toBe("jules@rout.be");
    expect(aliasEmailFor("  ")).toBeNull();
  });

  it("reports verification and payment independently of the badge", () => {
    const status = toMemberStatus({
      username: "ada",
      verified: true,
      is_paid: true,
      is_early_believer: true,
    });
    expect(status).toMatchObject({ verified: true, isPaid: true, earlyBeliever: true });
  });

  it("does not invent an early believer flag the database never set (RLS-hidden row)", () => {
    // A row the caller may not read comes back as null through RLS.
    expect(toMemberStatus(null).earlyBeliever).toBe(false);
    expect(toBaselineStatus(null).earlyBeliever).toBe(true);
  });
});

describe("needsEarlyBelieverBackfill", () => {
  it.each([
    [null, true],
    [{ is_early_believer: false }, true],
    [{ is_early_believer: null }, true],
    [{ is_early_believer: true }, false],
  ] as [MembershipProfileRow, boolean][])("%o -> %s", (row, expected) => {
    expect(needsEarlyBelieverBackfill(row)).toBe(expected);
  });
});

describe("applyMemberBaseline", () => {
  it("grants the badge to a brand new registration without payment or verification", async () => {
    const { state, deps } = fakeBackend({ username: "new", is_early_believer: false });
    const status = await applyMemberBaseline(deps);

    expect(state.updates).toBe(1);
    expect(state.badges.has("early_believer")).toBe(true);
    expect(status).toMatchObject({
      earlyBeliever: true,
      blueMark: true,
      verified: false,
      isPaid: false,
      aliasEmail: "new@rout.be",
    });
  });

  it("is idempotent: repeated sign-ins never rewrite the flag", async () => {
    const { state, deps } = fakeBackend({ username: "new", is_early_believer: false });
    await applyMemberBaseline(deps);
    await applyMemberBaseline(deps);
    await applyMemberBaseline(deps);

    expect(state.updates).toBe(1);
    expect(state.badgeCalls).toBe(3); // badge granting itself de-duplicates
    expect(state.badges.size).toBe(1);
  });

  it("leaves verification untouched", async () => {
    const { deps } = fakeBackend({ username: "ada", verified: true, is_early_believer: true });
    const status = await applyMemberBaseline(deps);
    expect(status.verified).toBe(true);
    expect(status.earlyBeliever).toBe(true);
  });

  it("still reports the baseline when the profile row is unreadable", async () => {
    const { state, deps } = fakeBackend(null);
    const status = await applyMemberBaseline(deps);
    expect(status.earlyBeliever).toBe(true);
    expect(status.username).toBeNull();
    expect(state.updates).toBe(1);
  });
});

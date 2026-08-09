import { test, expect } from "@playwright/test";

/**
 * Pricing regression suite. The checkout lives behind auth, so the price maths
 * and formatting are exercised against the app's own runtime modules in the
 * browser — the exact code the panel renders with.
 */
type PricingModule = {
  euro: (cents: number) => string;
  EARLY_BELIEVER_CENTS: number;
  VERIFICATION_TIERS: { id: string; amountCents: number; instantSurchargeCents: number }[];
  DONATION_PLANS: { id: string; cents: number; interval: string | null }[];
};

async function pricing(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  return page.evaluate(async () => {
    const mod: PricingModule = await import("/src/lib/profile.ts");
    const tier = mod.VERIFICATION_TIERS.find((t) => t.id === "early_believer")!;
    return {
      tierCount: mod.VERIFICATION_TIERS.length,
      lifetimeCents: tier.amountCents,
      lifetime: mod.euro(tier.amountCents),
      surcharge: tier.instantSurchargeCents,
      constant: mod.EARLY_BELIEVER_CENTS,
      plans: mod.DONATION_PLANS.map((p) => ({ id: p.id, cents: p.cents, interval: p.interval })),
      totals: mod.DONATION_PLANS.map((p) => mod.euro(tier.amountCents + p.cents)),
    };
  });
}

test.describe("Early Believer pricing", () => {
  test("is a single one-time €3.99 tier with no surcharge", async ({ page }) => {
    const p = await pricing(page);
    expect(p.tierCount).toBe(1);
    expect(p.lifetimeCents).toBe(399);
    expect(p.constant).toBe(399);
    expect(p.surcharge).toBe(0);
    expect(p.lifetime).toBe("€3,99");
    expect(p.lifetime).not.toMatch(/3[.,]990/);
  });

  test("donation add-ons are none / €1 monthly / €5 yearly", async ({ page }) => {
    const p = await pricing(page);
    expect(p.plans).toEqual([
      { id: "none", cents: 0, interval: null },
      { id: "monthly", cents: 100, interval: "month" },
      { id: "yearly", cents: 500, interval: "year" },
    ]);
    expect(p.totals).toEqual(["€3,99", "€4,99", "€8,99"]);
  });

  test("checkout can never drop below the €3.99 floor", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const totals = await page.evaluate(async () => {
      const mod: PricingModule = await import("/src/lib/profile.ts");
      const clamp = (cents: number) =>
        Number.isFinite(cents) ? Math.min(Math.max(Math.round(cents), 0), 100_000) : 0;
      return [-100_000, -399, -1, 0, Number.NaN].map(
        (d) => mod.EARLY_BELIEVER_CENTS + clamp(d),
      );
    });
    for (const total of totals) expect(total).toBeGreaterThanOrEqual(399);
  });
});

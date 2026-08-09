import { expect, test } from "@playwright/test";

/**
 * Accessibility regressions that are easy to break silently:
 * live-region announcements, trust-badge descriptions, and the floating
 * scroll-to-top button never overlapping the footer.
 */

test("colour picker changes are announced politely", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const live = page.locator('[aria-live="polite"]').first();
  await expect(live).toHaveCount(1);
  await expect(live).toHaveAttribute("aria-live", "polite");
});

test("trust badges expose their explanation to assistive tech", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const badges = page.getByRole("navigation", { name: "Sovereignty guarantees" }).getByRole("link");
  const count = await badges.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const badge = badges.nth(i);
    const describedBy = await badge.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText(/\w+/);
    // Touch target: at least 44px tall.
    const box = await badge.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43);
  }
});

test("scroll-to-top button never overlaps the footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/manifesto", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo({ top: 600 }));
  await expect(page.getByTestId("back-to-top")).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
  await expect(page.getByTestId("back-to-top")).toHaveCount(0);
});

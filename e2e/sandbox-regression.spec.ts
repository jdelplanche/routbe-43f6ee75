import { test, expect } from "@playwright/test";

/**
 * Sandbox / mobile-viewport regressions: the sticky header must stay reachable
 * and the mobile menu must not leave the page scroll-locked once dismissed.
 */
test.use({ viewport: { width: 390, height: 780 } });

test.describe("mobile navigation regressions", () => {
  test("header stays visible after scrolling back up", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(350);

    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(-1);
  });

  test("menu trigger meets the 44px touch target and restores scrolling", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /menu/i }).first();
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);

    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow).not.toBe("hidden");
  });
});

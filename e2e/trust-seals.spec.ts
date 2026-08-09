import { test, expect } from "@playwright/test";

test.describe("trust seals", () => {
  test("compact grid renders 5 seals in two mobile columns", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/sovereignty");
    await page.waitForLoadState("networkidle");
    const cards = page.locator("#badges button[aria-haspopup='dialog']");
    await expect(cards).toHaveCount(5);

    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(first && second).toBeTruthy();
    // Side by side on mobile.
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(4);
    expect(second!.x).toBeGreaterThan(first!.x);
    // No horizontal overflow.
    expect(second!.x + second!.width).toBeLessThanOrEqual(361);
  });

  test("clicking a seal opens the proof dialog and ESC closes it", async ({ page }) => {
    await page.goto("/sovereignty");
    await page.waitForLoadState("networkidle");
    const card = page.locator("#badges button[aria-haspopup='dialog']").first();
    await card.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("seal card is keyboard reachable and activates with Enter", async ({ page }) => {
    await page.goto("/sovereignty");
    await page.waitForLoadState("networkidle");
    const card = page.locator("#badges button[aria-haspopup='dialog']").first();
    await card.focus();
    // Re-press until hydration has attached the click handler.
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });
});

test.describe("sign up password field", () => {
  test("eye toggle reveals the password and the meter reacts", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /sign up/i }).click();
    const input = page.locator("input[autocomplete='new-password']:visible").first();
    await input.fill("abc");
    const meter = page.getByTestId("password-strength");
    await expect(meter).toHaveAttribute("data-level", "1");
    await input.fill("Abcdefg1!");
    await expect(meter).toHaveAttribute("data-level", "3");

    await expect(input).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(input).toHaveAttribute("type", "password");
  });
});

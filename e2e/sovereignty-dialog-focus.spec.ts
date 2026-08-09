import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Trust-seal proof dialogs on /sovereignty must return focus to the exact
 * badge that opened them, whether closed via ESC or a backdrop click.
 */

function seal(page: Page, index: number): Locator {
  return page.locator("#badges button[aria-haspopup='dialog']").nth(index);
}

test.describe("sovereignty proof dialog focus management", () => {
  test("ESC returns focus to the triggering badge", async ({ page }) => {
    await page.goto("/sovereignty", { waitUntil: "networkidle" });

    const badge = seal(page, 1);
    const badgeId = await badge.getAttribute("id");
    await badge.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(page.locator(`#${badgeId}`)).toBeFocused();
  });

  test("backdrop click returns focus to the triggering badge", async ({ page }) => {
    await page.goto("/sovereignty", { waitUntil: "networkidle" });

    const badge = seal(page, 3);
    const badgeId = await badge.getAttribute("id");
    await badge.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Click outside the dialog content to trigger the Radix overlay.
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();

    await expect(page.locator(`#${badgeId}`)).toBeFocused();
  });

  test("focus returns to the specific badge that was clicked, not the first one", async ({
    page,
  }) => {
    await page.goto("/sovereignty", { waitUntil: "networkidle" });

    const first = seal(page, 0);
    const last = seal(page, 4);
    const lastId = await last.getAttribute("id");

    await last.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(page.locator(`#${lastId}`)).toBeFocused();
    await expect(first).not.toBeFocused();
  });
});

import { test, expect } from "@playwright/test";

/**
 * Language persistence: the chosen locale must survive a full reload and be
 * reachable with the keyboard alone (WCAG 2.1.1 / 4.1.2).
 */
test.describe("language toggle", () => {
  test("persists the selected locale across a reload", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("radiogroup").first();
    await group.getByRole("radio", { name: "FR" }).click();
    await expect(group.getByRole("radio", { name: "FR" })).toHaveAttribute("aria-checked", "true");

    const stored = await page.evaluate(() => localStorage.getItem("rout_lang"));
    expect(stored).toBe("fr");

    await page.reload();
    await expect(
      page.getByRole("radiogroup").first().getByRole("radio", { name: "FR" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("is operable with arrow keys and exposes a single tab stop", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("radiogroup").first();
    const radios = group.getByRole("radio");
    const count = await radios.count();

    let focusable = 0;
    for (let i = 0; i < count; i += 1) {
      if ((await radios.nth(i).getAttribute("tabindex")) === "0") focusable += 1;
    }
    expect(focusable).toBe(1);

    await radios.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(radios.nth(1)).toBeFocused();
    await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("End");
    await expect(radios.nth(count - 1)).toBeFocused();
  });
});

import { expect, test, type Page } from "@playwright/test";

/**
 * PasswordField a11y + behaviour: eye toggle, live strength meter/checklist,
 * and submit gating on the sign-up flow — across light and dark mode.
 */

const THEMES = ["light", "dark"] as const;

async function applyTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

/** Freeze motion so snapshots never race a transition. */
async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }`,
  });
}

async function goToSignup(page: Page) {
  await page.goto("/auth?mode=signup", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /sign up/i }).click();
}

for (const theme of THEMES) {
  test.describe(`password field — ${theme} mode`, () => {
    test(`eye toggle switches visibility (${theme})`, async ({ page }) => {
      await goToSignup(page);
      await applyTheme(page, theme);
      await stabilize(page);

      const input = page.locator("input[autocomplete='new-password']:visible").first();
      await input.fill("Sup3rSecret!");

      await expect(input).toHaveAttribute("type", "password");
      const toggle = page.getByTestId("password-toggle");
      await toggle.click();
      await expect(input).toHaveAttribute("type", "text");
      await toggle.click();
      await expect(input).toHaveAttribute("type", "password");
    });

    test(`strength meter, checklist and hint update live (${theme})`, async ({ page }) => {
      await goToSignup(page);
      await applyTheme(page, theme);
      await stabilize(page);

      const input = page.locator("input[autocomplete='new-password']:visible").first();
      const meter = page.getByTestId("password-strength");
      const hint = page.getByTestId("password-hint");

      await input.fill("abc");
      await expect(meter).toHaveAttribute("data-level", "1");
      await expect(hint).toHaveAttribute("aria-live", "polite");
      await expect(hint).toContainText(/at least 8 characters/i);

      await input.fill("abcdefgh");
      await expect(meter).toHaveAttribute("data-level", "2");
      await expect(hint).toContainText(/uppercase/i);

      await input.fill("Abcdefg1!");
      await expect(meter).toHaveAttribute("data-level", "3");
      await expect(hint).toContainText(/meets all requirements/i);

      await expect(meter).toHaveScreenshot(`password-strength-${theme}-strong.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`sign-up submit stays disabled until password is compliant (${theme})`, async ({
      page,
    }) => {
      await goToSignup(page);
      await applyTheme(page, theme);
      await stabilize(page);

      const email = page.locator("input[type='email']:visible").first();
      await email.fill("e2e@rout.app");

      const submit = page.getByRole("button", { name: /create account/i });
      await expect(submit).toBeDisabled();

      const input = page.locator("input[autocomplete='new-password']:visible").first();
      await input.fill("weak");
      await expect(submit).toBeDisabled();

      await input.fill("Abcdefg1!");
      await expect(submit).toBeEnabled();
    });
  });

  test(`sign-in with existing password is never gated by strength (${theme})`, async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" });
    await applyTheme(page, theme);
    await page.getByRole("button", { name: /sign in with password instead/i }).click();

    const email = page.locator("input[type='email']:visible").first();
    await email.fill("e2e@rout.app");
    const password = page.locator("input[type='password']:visible").first();
    await password.fill("anything");

    const submit = page.getByRole("button", { name: /^sign in$/i });
    await expect(submit).toBeEnabled();
  });
}

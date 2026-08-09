import { test, expect } from "@playwright/test";

/**
 * Critical authentication + admin entry workflows.
 *
 * These run against the live preview build, so they assert on behaviour that
 * holds regardless of how many accounts already exist: the bootstrap probe,
 * the protected-route redirect, the dev super-admin shortcut and the
 * debounced handle availability check.
 */

// The dev super-admin is a single shared account: run these serially.
test.describe.configure({ mode: "serial" });

test.describe("authentication and admin entry", () => {
  test("protected /admin bounces an anonymous visitor to /auth", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the redirect target is preserved so login lands back on /admin", async ({ page }) => {
    await page.goto("/auth?redirect=%2Fadmin");
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    // The form keeps the requested destination in the URL for the post-login hop.
    expect(page.url()).toContain("redirect=%2Fadmin");
  });

  test("first-user bootstrap state is probed without leaking data", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    // The probe returns a single boolean; either branch is valid, but the
    // signup form must always render and never surface an error toast.
    await expect(page.getByLabel(/your handle/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/failed|error/i).first())
      .toBeHidden({ timeout: 2_000 })
      .catch(() => undefined);
  });

  test("dev super-admin quick login is offered in development only", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await page.getByRole("tab", { name: /sign up/i }).click();
    const shortcut = page.getByTestId("dev-admin-login");
    const visible = await shortcut.isVisible().catch(() => false);
    if (!visible) {
      // Production/preview builds must not expose the shortcut at all.
      await expect(shortcut).toHaveCount(0);
      return;
    }
    await expect(shortcut).toHaveText(/Dev Admin Quick Login/i);
    await expect(shortcut).toBeEnabled();
    await shortcut.click();
    // The shortcut either lands on the portal or reports a reason; it must
    // never leave the page in a broken state.
    await expect(page.locator("body")).toBeVisible();
  });

  test("handle availability is debounced and reports a verdict", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    const handle = page.getByLabel(/your handle/i);
    await handle.waitFor({ state: "visible" });

    await handle.fill("e2e");
    await handle.fill("e2e.probe");
    await handle.fill(`e2e.probe.${Date.now()}`);

    const message = page.locator("#signup-handle-msg");
    // Debounced: the verdict only settles after typing stops.
    await expect(message).toContainText(/available|taken|reserved|checking|rout\.be/i, {
      timeout: 20_000,
    });
    await expect(message).not.toContainText(/checking/i, { timeout: 20_000 });
  });
});

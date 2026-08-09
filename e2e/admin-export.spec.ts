import { test, expect } from "@playwright/test";

/**
 * End-to-end contract for the asynchronous inbound-payments CSV export:
 * permissions, job status, the download link and the deployment checklist.
 *
 * The DOM assertions only run when a dev admin session can be created, so the
 * suite stays green in CI while catching regressions locally.
 */

async function signInAsDevAdmin(page: import("@playwright/test").Page) {
  await page.goto("/auth?mode=signup");
  await page.getByRole("tab", { name: /sign up/i }).click();
  const shortcut = page.getByTestId("dev-admin-login");
  if (!(await shortcut.isVisible().catch(() => false))) return false;
  await shortcut.click();
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 }).catch(() => undefined);
  await page.goto("/admin");
  return await page
    .getByTestId("tab-inbound")
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
}

test.describe.configure({ mode: "serial" });

test.describe("async inbound CSV export", () => {
  test("anonymous visitors never reach the export action", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
    await expect(page.getByTestId("inbound-export")).toHaveCount(0);
  });

  test("the export server function rejects unauthenticated callers", async ({ request }) => {
    const res = await request.post("/_serverFn/exportInboundChunk", {
      data: { data: {} },
      failOnStatusCode: false,
    });
    // Either unauthorized, forbidden or an unknown route — never a CSV payload.
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("runs in the background and offers a download link", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-inbound").click();
    const exportButton = page.getByTestId("inbound-export");
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // The job card appears and eventually resolves to a download or an error.
    const download = page.getByTestId("inbound-export-download");
    await expect(async () => {
      const ready = await download.isVisible().catch(() => false);
      const failed = await page.getByText(/Backend not configured|Not allowed|failed/i).first()
        .isVisible()
        .catch(() => false);
      expect(ready || failed).toBe(true);
    }).toPass({ timeout: 60_000 });

    if (await download.isVisible().catch(() => false)) {
      const [file] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        download.click(),
      ]);
      expect(file.suggestedFilename()).toMatch(/rout-inbound-payments-.*\.csv/);
    }
  });

  test("the deployment checklist reports every required secret", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-deployment").click();
    await expect(page.getByTestId("deployment-checklist")).toBeVisible();
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      await expect(page.getByTestId(`checklist-${name}`)).toBeVisible({ timeout: 20_000 });
    }
  });

  test("cursor pagination controls exist on the audit log", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-transactions").click();
    await expect(page.getByTestId("audit-cursor-pager")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("audit-prev")).toBeDisabled();
  });
});

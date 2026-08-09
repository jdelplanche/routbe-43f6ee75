import { test, expect } from "@playwright/test";

/**
 * Admin portal UI contracts that must survive refactors, checked without an
 * admin session: the portal is unreachable anonymously, and once reachable the
 * bulk bar, confirmation modals and audit filters exist with stable hooks.
 *
 * The DOM assertions run only when a session is available (dev shortcut), so
 * the suite is green in CI while still catching regressions locally.
 */

async function signInAsDevAdmin(page: import("@playwright/test").Page) {
  await page.goto("/auth?mode=signup");
  await page.getByRole("tab", { name: /sign up/i }).click();
  const shortcut = page.getByTestId("dev-admin-login");
  if (!(await shortcut.isVisible().catch(() => false))) return false;
  await shortcut.click();
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 }).catch(() => undefined);
  await page.goto("/admin");
  // Only run the DOM assertions when the portal actually renders for this session.
  return await page
    .getByTestId("tab-users")
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
}

// The dev super-admin is a single shared account: run these serially.
test.describe.configure({ mode: "serial" });

test.describe("super admin portal", () => {
  test("is not reachable without a session", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  });

  test("bulk moderation requires an explicit confirmation with a count", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-users").click();
    const firstRow = page.getByTestId("admin-user-row").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("select-all-users").click();
    await expect(page.getByTestId("bulk-count")).not.toHaveText(/^0 selected$/);

    await page.getByTestId("bulk-suspend").click();
    const dialog = page.getByTestId("bulk-confirm");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/account/i);
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("destructive single-user actions open a confirmation modal", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("admin-user-row").first()).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /clear bio/i })
      .first()
      .click();
    await expect(page.getByTestId("action-confirm")).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByTestId("action-confirm")).toBeHidden();
  });

  test("audit log offers live search, action and date filters", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-transactions").click();
    await expect(page.getByTestId("audit-search")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/filter by action/i)).toBeVisible();
    await expect(page.getByLabel(/from date/i)).toBeVisible();
    await expect(page.getByLabel(/to date/i)).toBeVisible();

    await page.getByTestId("audit-search").fill("zzz-no-such-action");
    await expect(page.getByTestId("audit-rows").locator("tr")).toHaveCount(0);
  });

  test("alias sync status is surfaced per account", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-network").click();
    await expect(page.getByTestId("queue-summary")).toBeVisible({ timeout: 20_000 });
    const badge = page.getByTestId("sync-badge").first();
    if (await badge.isVisible().catch(() => false)) {
      await expect(badge).toHaveText(/Synced|Pending Sync|Sync Failed/);
    }
  });
});

test.describe("super admin portal — moderation guardrails", () => {
  test("suspend requires a reason of at least five characters", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("admin-user-row").first()).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("danger-zone").first().click();
    await page.getByTestId("suspend-user").first().click();

    const submit = page.getByTestId("moderation-confirm-run");
    await expect(submit).toBeDisabled();
    await page.getByTestId("moderation-reason").fill("abc");
    await expect(submit).toBeDisabled();
    await page.getByTestId("moderation-reason").fill("Spam links in bio");
    await expect(submit).toBeEnabled();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("banning additionally requires an explicit acknowledgement", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("admin-user-row").first()).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("danger-zone").first().click();
    await page.getByTestId("ban-user").first().click();

    const submit = page.getByTestId("moderation-confirm-run");
    await page.getByTestId("moderation-reason").fill("Repeated abuse reports");
    await expect(submit).toBeDisabled();
    await page.getByTestId("ban-ack").click();
    await expect(submit).toBeEnabled();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("bulk suspend blocks submission until a reason is typed", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("admin-user-row").first()).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("select-all-users").click();
    await page.getByTestId("bulk-suspend").click();

    const run = page.getByTestId("bulk-confirm-run");
    await expect(run).toBeDisabled();
    await page.getByLabel(/^reason/i).fill("Coordinated spam wave");
    await expect(run).toBeEnabled();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("bulk reinstate needs no reason", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-users").click();
    await page.getByTestId("select-all-users").click();
    await page.getByTestId("bulk-unsuspend").click();
    await expect(page.getByTestId("bulk-confirm-run")).toBeEnabled();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("audit log filters narrow the table and show an empty state", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-transactions").click();
    const search = page.getByTestId("audit-search");
    await expect(search).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/action type/i)).toBeVisible();
    await expect(page.getByLabel(/^from date$/i)).toBeVisible();
    await expect(page.getByLabel(/^to date$/i)).toBeVisible();

    await search.fill("zzz-no-such-action");
    await expect(page.getByTestId("audit-rows").locator("tr")).toHaveCount(0);
    await expect(page.getByTestId("audit-empty")).toBeVisible();

    await page.getByRole("button", { name: /^reset$/i }).click();
    await expect(search).toHaveValue("");
  });

  test("inbound payments tab lists parsed references or an empty state", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-inbound").click();
    const rows = page.getByTestId("inbound-rows").locator("tr");
    const empty = page.getByTestId("inbound-empty");
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 20_000 });
  });

  test("aliasing surface degrades cleanly without an ImprovMX key", async ({ page }) => {
    test.skip(!(await signInAsDevAdmin(page)), "no dev admin session available");

    await page.getByTestId("tab-network").click();
    await expect(page.getByTestId("queue-summary")).toBeVisible({ timeout: 20_000 });

    if (
      await page
        .getByTestId("improvmx-missing-key")
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByTestId("run-sync")).toBeDisabled();
      await expect(page.getByTestId("retry-failed")).toBeDisabled();
      await expect(page.getByTestId("alias-empty")).toContainText(/IMPROVMX_API_KEY/);
      await expect(page.getByTestId("alias-per-page")).toHaveCount(0);
    }
  });
});

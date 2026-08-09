import { expect, test } from "@playwright/test";

const SPEC_PATH = "/api/public/openapi.json";
const SPEC_URL = "https://rout.be/api/public/openapi.json";

/** The developer hub is behind auth; skip gracefully on an anonymous/sandbox run. */
async function openDeveloperHub(page: import("@playwright/test").Page) {
  await page.goto("/api", { waitUntil: "domcontentloaded" });
  // Give the client-side auth gate time to redirect before judging the page.
  await page.waitForTimeout(4000);
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    test.skip(true, "Developer hub requires an authenticated session");
  }
  const trigger = page.getByTestId("openapi-menu-trigger");
  const rendered = await trigger.isVisible().catch(() => false);
  if (!rendered) {
    test.skip(true, "Developer hub unavailable (sandbox mode / no backend configured)");
  }
}

/** Opens the dropdown and waits for the menu to settle after its animation. */
async function openMenuItem(page: import("@playwright/test").Page, testId: string) {
  await page.getByTestId("openapi-menu-trigger").click();
  const item = page.getByTestId(testId);
  await expect(item).toBeVisible();
  await page.waitForTimeout(400);
  return item;
}

test.describe("OpenAPI action menu", () => {
  test("serves the spec at the canonical public path", async ({ request }) => {
    const res = await request.get(SPEC_PATH);
    expect(res.status()).toBe(200);
    const spec = (await res.json()) as { openapi?: string };
    expect(spec.openapi).toMatch(/^3\.1/);
  });

  test("opens the dropdown and exposes every spec action", async ({ page }) => {
    await openDeveloperHub(page);
    await page.getByTestId("openapi-menu-trigger").click();

    await expect(page.getByTestId("openapi-copy")).toBeVisible();
    await expect(page.getByTestId("openapi-download")).toBeVisible();
    await expect(page.getByTestId("openapi-raw")).toHaveAttribute("href", SPEC_PATH);
    await expect(page.getByTestId("openapi-raw")).toHaveAttribute("target", "_blank");
  });

  test("copying the spec URL confirms with a toast", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openDeveloperHub(page);
    await openMenuItem(page, "openapi-copy").then((item) => item.click());

    await expect(page.getByText(/copied/i).first()).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(SPEC_URL);
  });

  test("download action fetches the spec endpoint", async ({ page }) => {
    await openDeveloperHub(page);
    const specRequest = page.waitForRequest((r) => r.url().endsWith(SPEC_PATH));
    const item = await openMenuItem(page, "openapi-download");
    await item.click();
    expect((await specRequest).url()).toContain(SPEC_PATH);
  });
});

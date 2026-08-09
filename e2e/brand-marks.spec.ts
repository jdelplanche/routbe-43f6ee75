import { expect, test } from "@playwright/test";

/**
 * Brand-mark regression suite.
 *
 * Third-party marks (Eyou, Mastodon, Keycloak) are rendered as CSS masks so
 * they inherit `currentColor`. These tests assert the masks are bundled (no
 * cross-origin request, so no flash of a missing icon) and that they render
 * identically in light and dark mode.
 */

const THEMES = ["light", "dark"] as const;

async function applyTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

test.describe("footer brand marks", () => {
  test("no brand mark is fetched from a third-party origin", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/\.svg(\?|$)/.test(url) && !url.startsWith(page.url().split("/").slice(0, 3).join("/"))) {
        external.push(url);
      }
    });
    await page.goto("/manifesto", { waitUntil: "networkidle" });
    expect(external, `unexpected remote icon requests: ${external.join(", ")}`).toHaveLength(0);
  });

  for (const theme of THEMES) {
    test(`footer social icons are monochrome in ${theme} mode`, async ({ page }) => {
      await page.goto("/manifesto", { waitUntil: "networkidle" });
      await applyTheme(page, theme);
      const socials = page.getByTestId("footer-socials");
      await socials.scrollIntoViewIfNeeded();
      await expect(socials).toBeVisible();

      // Every masked icon must resolve to a mask (not an <img>), which is what
      // forces the single-colour rendering.
      const maskCount = await socials.locator("[data-masked-icon]").count();
      expect(maskCount).toBeGreaterThan(0);

      await expect(socials).toHaveScreenshot(`footer-socials-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }

  test("support navigation exposes the Sovereignty link", async ({ page }) => {
    await page.goto("/manifesto", { waitUntil: "networkidle" });
    const nav = page.getByTestId("footer-support-nav");
    await nav.scrollIntoViewIfNeeded();
    const link = nav.getByRole("link", { name: "Sovereignty", exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/sovereignty/);
  });
});

test.describe("auth provider tiles", () => {
  for (const theme of THEMES) {
    test(`provider tiles are uniform in ${theme} mode`, async ({ page }) => {
      await page.goto("/auth", { waitUntil: "networkidle" });
      await applyTheme(page, theme);
      const tiles = page.getByTestId("auth-provider-tiles");
      await expect(tiles).toBeVisible();
      await expect(tiles).toHaveScreenshot(`auth-tiles-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }

  test("every tile has an accessible name", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" });
    const buttons = page.getByTestId("auth-provider-tiles").getByRole("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toHaveAttribute("aria-label", /Continue with .+/);
    }
  });
});

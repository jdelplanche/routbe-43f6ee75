import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Axe accessibility audit across the harmonized document routes, run in both
 * themes. `E2E_THEME` lets CI shard light/dark into separate jobs.
 */
const ROUTES = ["/", "/sovereignty", "/privacy", "/terms"];
const THEMES = (process.env["E2E_THEME"] ? [process.env["E2E_THEME"]] : ["light", "dark"]) as (
  "light" | "dark"
)[];

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

for (const theme of THEMES) {
  for (const route of ROUTES) {
    test(`${route} has no critical a11y violations (${theme})`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      await setTheme(page, theme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(serious, serious.map((v) => `${v.id}: ${v.nodes.length} node(s)`).join("\n")).toEqual(
        [],
      );
    });
  }
}

import { test, expect } from "@playwright/test";
import { openStudioWithPayload } from "./helpers";
import { inspectSvgStructure } from "../src/lib/qr-structure";

/** Anti-fallback guard: custom styles may never emit squares in timing lanes. */
const STYLES = ["mesh", "calligraphy", "ballpoint"] as const;

test.describe("custom QR structural integrity", () => {
  for (const style of STYLES) {
    test(`renders ${style} without timing-pattern square fallback`, async ({ page }) => {
      await openStudioWithPayload(page);
      // 1-tap selection straight from the pattern strip.
      await page.getByTestId(`pattern-tile-${style}`).click();
      await page.waitForTimeout(500);
      const svg = await page
        .locator("svg")
        .first()
        .evaluate((el) => el.outerHTML);
      const report = inspectSvgStructure(svg, style, { count: 33, origin: 0, module: 8 });
      expect(report.fallbackRects, report.message ?? "").toBe(0);
      expect(report.totalNodes).toBeGreaterThan(0);
    });
  }
});

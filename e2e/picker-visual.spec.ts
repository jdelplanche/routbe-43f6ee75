import { test, expect, type Page } from "@playwright/test";
import { openStudioWithPayload } from "./helpers";

/**
 * Visual regression coverage for the studio pickers.
 *
 * Every picker is an ARIA radiogroup, so we can locate them by accessible name
 * and snapshot the group itself — default, hovered, and keyboard-focused
 * (active) states — at mobile and desktop widths.
 */
const GROUPS = ["Theme", "Pattern", "Center logo", "Foreground color", "Background color"];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
];

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

function group(page: Page, name: string) {
  return page.getByRole("radiogroup", { name: new RegExp(name, "i") }).first();
}

for (const viewport of VIEWPORTS) {
  test.describe(`picker snapshots — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const name of GROUPS) {
      test(`${name} picker states`, async ({ page }) => {
        await openStudioWithPayload(page);
        await stabilize(page);

        const picker = group(page, name);
        if (!(await picker.isVisible().catch(() => false))) {
          test.skip(true, `${name} picker not visible at ${viewport.name} width`);
        }
        await picker.scrollIntoViewIfNeeded();

        // Default
        await expect(picker).toHaveScreenshot(`${viewport.name}-${name}-default.png`, {
          maxDiffPixelRatio: 0.02,
        });

        const options = picker.getByRole("radio");
        const count = await options.count();
        expect(count).toBeGreaterThan(0);

        // Hovered — second option when available, so it differs from selection.
        const hoverTarget = options.nth(count > 1 ? 1 : 0);
        await hoverTarget.hover();
        await expect(picker).toHaveScreenshot(`${viewport.name}-${name}-hover.png`, {
          maxDiffPixelRatio: 0.02,
        });

        // Active/selected — keyboard-driven, which also exercises roving focus.
        await options.first().focus();
        await page.keyboard.press("ArrowRight");
        await expect(picker).toHaveScreenshot(`${viewport.name}-${name}-active.png`, {
          maxDiffPixelRatio: 0.02,
        });

        // Exactly one option stays checked after keyboard selection.
        await expect(picker.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
      });
    }
  });
}

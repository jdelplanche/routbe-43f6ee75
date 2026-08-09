import { test, expect } from "@playwright/test";
import { openStudioWithPayload } from "./helpers";

/** B. The collapsible Scannable metrics accordion. */
test("scannable accordion opens and closes", async ({ page }) => {
  await openStudioWithPayload(page);

  const toggle = page.getByTestId("scan-safety-toggle");
  await expect(toggle).toBeVisible();
  // Collapsed state already surfaces the headline score.
  await expect(page.getByTestId("scan-safety-score")).toContainText("%");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const details = page.getByTestId("scan-safety-details");
  await expect(details).toHaveAttribute("data-state", "open");
  await expect(details).toContainText("Detected modules");
  await expect(details).toContainText("Error correction");
  await expect(details).toContainText("Logo coverage");
  await expect(details).toContainText("Minimum print size");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(details).toHaveAttribute("data-state", "closed");
});

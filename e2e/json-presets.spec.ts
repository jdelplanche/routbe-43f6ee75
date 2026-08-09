import { test, expect } from "@playwright/test";
import { openStudioWithPayload } from "./helpers";

const VALID_PRESET = JSON.stringify({
  schema: "rout.qr.presets.v1",
  version: 1,
  presets: [
    {
      id: "e2e-preset",
      name: "E2E Ink",
      version: 1,
      style: { bodyShape: "dots", fgColor: "#111111", bgColor: "#FFFFFF" },
    },
  ],
});

/** C. JSON preset export / import round trip. */
test.describe("JSON presets", () => {
  test("exports the saved presets as a JSON file", async ({ page }) => {
    await openStudioWithPayload(page);

    // Save the current style through the UI so a custom preset exists.
    await page.getByRole("button", { name: /Save current/i }).click();
    const nameInput = page.getByPlaceholder("Preset name");
    await nameInput.fill("E2E Local");
    await page.getByTestId("preset-save").click();
    await expect(page.getByRole("button", { name: "E2E Local", exact: true })).toBeVisible();

    const exportBtn = page.getByTestId("presets-export");
    await exportBtn.scrollIntoViewIfNeeded();
    const [download] = await Promise.all([page.waitForEvent("download"), exportBtn.click()]);
    expect(download.suggestedFilename()).toMatch(/^qr-styles-.*\.json$/);
  });

  test("imports a valid preset file and rejects an invalid one", async ({ page }) => {
    await openStudioWithPayload(page);
    const input = page.getByTestId("presets-import-input");

    await input.setInputFiles({
      name: "styles.json",
      mimeType: "application/json",
      buffer: Buffer.from(VALID_PRESET),
    });
    await expect(page.getByText(/geïmporteerd/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("E2E Ink")).toBeVisible();

    await input.setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ not json"),
    });
    await expect(page.getByText(/Import mislukt/i)).toBeVisible({ timeout: 10_000 });
  });
});

import { expect, type Page } from "@playwright/test";

/** Opens the studio with a payload so the export actions become active. */
export async function openStudioWithPayload(page: Page, value = "https://rout.app/e2e") {
  await page.goto("/", { waitUntil: "networkidle" });
  const input = page.getByPlaceholder("https://delplanche.com").first();
  await input.waitFor({ state: "visible" });
  // Hydration guard: retry until React actually owns the controlled input.
  await expect(async () => {
    await input.fill(value);
    expect(await input.inputValue()).toBe(value);
    await expect(page.getByTestId("download-qr")).toBeEnabled({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Clicks Download and confirms any pre-flight dialog (density or contrast),
 * so the test always reaches the actual export pipeline.
 */
export async function startExport(page: Page) {
  await page.getByTestId("download-qr").click();
  const anyway = page.getByRole("button", { name: /Download anyway/i });
  const risky = page.getByTestId("contrast-continue");
  for (const candidate of [anyway, risky]) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
    }
  }
}

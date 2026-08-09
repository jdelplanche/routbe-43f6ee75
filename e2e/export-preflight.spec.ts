import { test, expect } from "@playwright/test";
import { openStudioWithPayload, startExport } from "./helpers";

/** A. Export preflight, download rollback and the contextual error toast. */
test.describe("export preflight & error handling", () => {
  test("runs the preflight and returns the button to its interactive state", async ({ page }) => {
    await openStudioWithPayload(page);
    const download = page.getByTestId("download-qr");
    await expect(download).toBeEnabled();

    const started = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
    await startExport(page);
    await started;

    // Rollback: never stuck in the loading state.
    await expect(download).toBeEnabled({ timeout: 20_000 });
    await expect(download).toHaveText(/Download QR code/i);
  });

  test("surfaces a contextual error toast with details and retry when rendering fails", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Force the download pipeline to fail so the recovery path is exercised.
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: never[]
      ) {
        // 1x1 probe canvas = the export preflight; make only that one fail.
        if (this.width === 1 && this.height === 1) return null;
        return (original as unknown as (...a: never[]) => unknown).apply(this, args);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await openStudioWithPayload(page);

    const download = page.getByTestId("download-qr");
    await startExport(page);

    const toast = page.getByTestId("export-error-toast");
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("export-error-details").click();
    await expect(toast.locator("pre")).toBeVisible();
    await expect(page.getByTestId("export-error-retry")).toBeVisible();
    await expect(download).toBeEnabled();
  });

  test("logs structured diagnostics and re-runs the export from the retry action", async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("ROUT Export Engine"))
        logs.push(msg.text());
    });
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: never[]
      ) {
        if (this.width === 1 && this.height === 1) return null;
        return (original as unknown as (...a: never[]) => unknown).apply(this, args);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await openStudioWithPayload(page);

    const download = page.getByTestId("download-qr");
    await startExport(page);
    await expect(page.getByTestId("export-error-toast")).toBeVisible({ timeout: 20_000 });
    expect(logs.length).toBeGreaterThan(0);

    // Retry re-triggers the export: the pipeline runs again and rolls back again.
    const before = logs.length;
    await page.getByTestId("export-error-retry").click();
    await expect.poll(() => logs.length, { timeout: 20_000 }).toBeGreaterThan(before);
    await expect(page.getByTestId("export-error-toast")).toBeVisible();
    await expect(download).toBeEnabled();
    await expect(download).toHaveText(/Download QR code/i);
  });
});

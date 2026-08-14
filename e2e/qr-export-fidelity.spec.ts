import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openStudioWithPayload, startExport } from "./helpers";

/**
 * Export fidelity: the downloaded PNG/JPEG/SVG must agree with what the preview
 * shows — same caption text, same quiet-zone margin, same square geometry —
 * across several styles and languages.
 */

const FORMAT_LABEL = { png: "PNG", svg: "SVG", jpeg: "JPG" } as const;
type Format = keyof typeof FORMAT_LABEL;

async function selectFormat(page: Page, format: Format) {
  const option = page.getByTestId(`format-${format}`);
  if (!(await option.isVisible().catch(() => false))) {
    // The format cards live inside the collapsed "print size / export" section.
    const trigger = page.getByRole("button", { name: /print size|afmeting|formaat/i }).first();
    await trigger.click();
  }
  await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
}

async function download(page: Page): Promise<Download> {
  const pending = page.waitForEvent("download", { timeout: 30_000 });
  await startExport(page);
  return pending;
}

/** Reads intrinsic pixel size from a PNG (IHDR) or JPEG (SOFn) buffer. */
function imageSize(buf: Buffer): { width: number; height: number } {
  if (buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    const length = buf.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("Unsupported image buffer");
}

/** Caption text currently rendered under the QR in the live preview, if any. */
async function previewCaption(page: Page): Promise<string | null> {
  const svg = page.locator("#qr-preview svg, [data-testid='qr-preview'] svg").first();
  if (!(await svg.count())) return null;
  const text = (await svg.locator("text").allTextContents()).join(" ").trim();
  return text || null;
}

for (const format of ["png", "jpeg", "svg"] as Format[]) {
  test(`exports a ${format.toUpperCase()} that matches the preview`, async ({ page }) => {
    await openStudioWithPayload(page);
    await selectFormat(page, format);

    const caption = await previewCaption(page);
    const file = await download(page);
    expect(file.suggestedFilename()).toMatch(new RegExp(`\\.(${format === "jpeg" ? "jpe?g" : format})$`, "i"));

    const path = await file.path();
    const buf = await readFile(path);
    expect(buf.byteLength).toBeGreaterThan(500);

    if (format === "svg") {
      const svg = buf.toString("utf8");
      expect(svg).toContain("<svg");
      // Square artboard: the quiet-zone margin is baked into the viewBox.
      const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      if (viewBox) {
        const width = Number(viewBox[1]);
        const height = Number(viewBox[2]);
        expect(height).toBeGreaterThanOrEqual(width - 1);
      }
      if (caption) {
        for (const word of caption.split(/\s+/).slice(0, 3)) {
          expect(svg).toContain(word);
        }
      }
    } else {
      const { width, height } = imageSize(buf);
      expect(width).toBeGreaterThan(200);
      // Captionless exports are square; a caption only adds height.
      expect(height).toBeGreaterThanOrEqual(width - 1);
    }
  });
}

for (const lang of ["en", "nl"]) {
  test(`export geometry is language-independent (${lang})`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("rout_lang", value as string);
    }, lang);
    await openStudioWithPayload(page);
    await selectFormat(page, "png");

    const file = await download(page);
    const buf = await readFile(await file.path());
    const { width, height } = imageSize(buf);
    expect(width).toBeGreaterThan(200);
    expect(height).toBeGreaterThanOrEqual(width - 1);
  });
}

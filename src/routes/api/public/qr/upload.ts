import { createFileRoute } from "@tanstack/react-router";

const RATE_LIMIT = { maxUploads: 15, windowMs: 60 * 60 * 1000 };
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_TYPES = ["image", "pdf", "mp3"];

const allowedMimeTypes: Record<string, { extensions: string[]; signatures: number[][] }> = {
  "image/jpeg": { extensions: ["jpg", "jpeg"], signatures: [[0xff, 0xd8, 0xff]] },
  "image/png": {
    extensions: ["png"],
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  "image/gif": {
    extensions: ["gif"],
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ],
  },
  "image/webp": { extensions: ["webp"], signatures: [[0x52, 0x49, 0x46, 0x46]] },
  "application/pdf": { extensions: ["pdf"], signatures: [[0x25, 0x50, 0x44, 0x46]] },
  "audio/mpeg": {
    extensions: ["mp3"],
    signatures: [
      [0xff, 0xfb],
      [0xff, 0xfa],
      [0xff, 0xf3],
      [0xff, 0xf2],
      [0x49, 0x44, 0x33],
    ],
  },
  "audio/mp3": {
    extensions: ["mp3"],
    signatures: [
      [0xff, 0xfb],
      [0xff, 0xfa],
      [0xff, 0xf3],
      [0xff, 0xf2],
      [0x49, 0x44, 0x33],
    ],
  },
};

function validateFileSignature(bytes: Uint8Array, mimeType: string): boolean {
  const config = allowedMimeTypes[mimeType];
  if (!config) return false;
  return config.signatures.some(
    (sig) => bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b),
  );
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\0/g, "")
    .slice(0, 100);
}

export const Route = createFileRoute("/api/public/qr/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { admin, getClientIp, json, randomId, siteOrigin, serverError } =
          await import("@/lib/qr-api.server");
        const db = await admin();

        try {
          // --- rate limit (best effort: never blocks on internal errors) ---
          const clientIp = getClientIp(request);
          const now = new Date();
          const { data: existing } = await db
            .from("upload_rate_limits")
            .select("*")
            .eq("client_ip", clientIp)
            .maybeSingle();

          if (!existing) {
            await db
              .from("upload_rate_limits")
              .insert({ client_ip: clientIp, upload_count: 1, window_start: now.toISOString() });
          } else if (
            new Date(existing.window_start).getTime() <
            now.getTime() - RATE_LIMIT.windowMs
          ) {
            await db
              .from("upload_rate_limits")
              .update({
                upload_count: 1,
                window_start: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq("client_ip", clientIp);
          } else if (existing.upload_count >= RATE_LIMIT.maxUploads) {
            const resetAt = new Date(
              new Date(existing.window_start).getTime() + RATE_LIMIT.windowMs,
            );
            const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
            return json({ error: "Too many uploads. Please try again later.", retryAfter }, 429, {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": resetAt.toISOString(),
            });
          } else {
            await db
              .from("upload_rate_limits")
              .update({ upload_count: existing.upload_count + 1, updated_at: now.toISOString() })
              .eq("client_ip", clientIp);
          }

          // --- parse + validate ---
          let formData: FormData;
          try {
            formData = await request.formData();
          } catch (e) {
            console.error("FormData parsing error:", e);
            return json({ error: "Invalid form data. Please re-select your file." }, 400);
          }

          const file = formData.get("file") as File | null;
          const type = formData.get("type") as string | null;

          if (!file) return json({ error: "No file provided" }, 400);
          if (!type || !VALID_TYPES.includes(type))
            return json({ error: "Invalid upload type" }, 400);
          if (file.size === 0) return json({ error: "File is empty" }, 400);
          if (file.size > MAX_FILE_SIZE) return json({ error: "File is larger than 10MB" }, 400);

          const mime = file.type;
          const config = allowedMimeTypes[mime];
          if (!config) return json({ error: `Unsupported file type: ${mime || "unknown"}` }, 400);

          const ext = sanitizeFilename(file.name).split(".").pop()?.toLowerCase() ?? "";
          if (!config.extensions.includes(ext)) {
            return json({ error: "File extension does not match its content type" }, 400);
          }

          const buffer = new Uint8Array(await file.arrayBuffer());
          if (!validateFileSignature(buffer, mime)) {
            return json({ error: "File content does not match its declared type" }, 400);
          }

          const path = `${type}/${Date.now()}-${randomId(10)}.${ext}`;
          const { error: uploadError } = await db.storage
            .from("qr-files")
            .upload(path, buffer, { contentType: mime, cacheControl: "31536000", upsert: false });

          if (uploadError) {
            console.error("storage upload failed", uploadError);
            return json({ error: "Upload failed" }, 500);
          }

          return json({
            url: `${siteOrigin(request)}/api/public/file/${path}`,
            path,
            size: file.size,
            type: mime,
          });
        } catch (e) {
          console.error(e);
          return serverError(e);
        }
      },
    },
  },
});

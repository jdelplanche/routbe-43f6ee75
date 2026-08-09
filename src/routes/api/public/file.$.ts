import { createFileRoute } from "@tanstack/react-router";

// Serves uploaded QR assets from the private storage bucket over a stable,
// permanent public URL (QR codes must keep resolving forever).
export const Route = createFileRoute("/api/public/file/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { admin } = await import("@/lib/qr-api.server");
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

        try {
          const db = await admin();
          const { data, error } = await db.storage.from("qr-files").download(path);
          if (error || !data) return new Response("Not found", { status: 404 });

          return new Response(await data.arrayBuffer(), {
            status: 200,
            headers: {
              "Content-Type": data.type || "application/octet-stream",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch (e) {
          console.error("file serve error", e);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});

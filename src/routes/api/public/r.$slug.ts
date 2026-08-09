import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/r/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { admin, detectDevice } = await import("@/lib/qr-api.server");
        const slug = params.slug;
        if (!slug) return new Response("Not found", { status: 404 });

        try {
          const db = await admin();
          const { data: tracked, error } = await db
            .from("tracked_qrs")
            .select("id, user_id, target_url, is_active, expires_at")
            .eq("slug", slug)
            .maybeSingle();

          if (error || !tracked) {
            return new Response("QR code not found", {
              status: 404,
              headers: { "content-type": "text/plain" },
            });
          }
          if (tracked.is_active === false) {
            return new Response("This QR link has been disabled.", {
              status: 410,
              headers: { "content-type": "text/plain" },
            });
          }
          if (tracked.expires_at && new Date(tracked.expires_at).getTime() < Date.now()) {
            return new Response("This QR link has expired.", {
              status: 410,
              headers: { "content-type": "text/plain" },
            });
          }

          // Moderation: a suspended or banned owner has all redirects paused.
          if (tracked.user_id) {
            const { data: owner } = await db
              .from("profiles")
              .select("is_suspended, is_banned")
              .eq("id", tracked.user_id)
              .maybeSingle();
            if (owner?.is_suspended || owner?.is_banned) {
              return new Response("This QR link is temporarily suspended.", {
                status: 403,
                headers: { "content-type": "text/plain", "Cache-Control": "no-store" },
              });
            }
          }


          const ua = request.headers.get("user-agent") ?? "";
          const country =
            request.headers.get("cf-ipcountry") ||
            request.headers.get("x-country") ||
            request.headers.get("x-vercel-ip-country") ||
            null;

          const { error: insErr } = await db.from("qr_scans").insert({
            tracked_qr_id: tracked.id,
            country,
            device: detectDevice(ua),
            user_agent: ua.slice(0, 500),
          });
          if (insErr) console.error("scan insert failed", insErr);

          return new Response(null, {
            status: 302,
            headers: {
              Location: tracked.target_url,
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          });
        } catch (e) {
          console.error("redirect error", e);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});

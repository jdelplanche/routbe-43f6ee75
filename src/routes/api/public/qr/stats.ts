import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/qr/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { admin, csvEscape, json, siteOrigin, detectBrowser, detectOs, serverError } =
          await import("@/lib/qr-api.server");
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get("token");
          const format = url.searchParams.get("format");
          if (!token || token.length < 12) return json({ error: "Missing or invalid token" }, 400);

          const db = await admin();
          const { data: tracked, error } = await db
            .from("tracked_qrs")
            .select("id, slug, target_type, target_url, label, created_at, is_active, expires_at")
            .eq("dashboard_token", token)
            .maybeSingle();

          if (error || !tracked) return json({ error: "Not found" }, 404);

          const { data: scans, error: scansErr } = await db
            .from("qr_scans")
            .select("scanned_at, country, device, user_agent")
            .eq("tracked_qr_id", tracked.id)
            .order("scanned_at", { ascending: false })
            .limit(10000);

          if (scansErr) {
            console.error(scansErr);
            return json({ error: "Failed to load scans" }, 500);
          }

          if (format === "csv") {
            const header = "scanned_at,country,device,user_agent";
            const lines = (scans ?? []).map(
              (s) =>
                `${csvEscape(s.scanned_at)},${csvEscape(s.country)},${csvEscape(s.device)},${csvEscape(s.user_agent)}`,
            );
            return new Response([header, ...lines].join("\n"), {
              status: 200,
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="qr-scans-${tracked.slug}.csv"`,
              },
            });
          }

          return json({
            tracked: {
              ...tracked,
              redirect_url: `${siteOrigin(request)}/api/public/r/${tracked.slug}`,
            },
            scans: (scans ?? []).map(({ scanned_at, country, device, user_agent }) => ({
              scanned_at,
              country,
              device,
              browser: detectBrowser(user_agent),
              os: detectOs(user_agent),
            })),
            total: (scans ?? []).length,
          });
        } catch (e) {
          console.error(e);
          return serverError(e);
        }
      },
    },
  },
});

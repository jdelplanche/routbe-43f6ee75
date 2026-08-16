import { createFileRoute } from "@tanstack/react-router";

/**
 * Privacy-first profile analytics: counts a view or a link click.
 * No cookies, no IP storage — only an aggregated event row.
 */
export const Route = createFileRoute("/api/public/profile/event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            username?: string;
            type?: string;
            kind?: string;
          } | null;

          const username = String(body?.username ?? "")
            .replace(/^@+/, "")
            .toLowerCase()
            .slice(0, 40);
          const type = body?.type === "click" ? "click" : "view";
          const kind = String(body?.kind ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, 32);

          if (!username) return new Response(null, { status: 204 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("username", username)
            .maybeSingle();
          if (!profile) return new Response(null, { status: 204 });

          const ua = request.headers.get("user-agent") ?? "";
          const device = /mobile|android|iphone/i.test(ua)
            ? "mobile"
            : /ipad|tablet/i.test(ua)
              ? "tablet"
              : "desktop";

          // Referrer host only — never the full URL (no query strings, no PII).
          let referrer: string | null = null;
          const raw = request.headers.get("referer");
          if (raw) {
            try {
              referrer = new URL(raw).hostname;
            } catch {
              referrer = null;
            }
          }

          // `link_click` requires the extended check constraint shipped in
          // db/manual/20260817_profile_analytics_events.sql. Until it is applied
          // the insert is rejected (23514) and we simply drop the event.
          const { error } = await supabaseAdmin.from("analytics_events").insert({
            profile_id: profile.id,
            event_type: type === "click" ? "link_click" : "profile_view",
            device_type: device,
            // Clicks reuse the referrer column to store the block kind.
            referrer: type === "click" ? kind || "link" : referrer,
          });
          if (error) console.error("[profile-event] insert failed", error.code, error.message);

          return new Response(null, { status: 204 });
        } catch (error) {
          console.error("[profile-event]", error);
          return new Response(null, { status: 204 });
        }
      },
    },
  },
});

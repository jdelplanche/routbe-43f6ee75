import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/qr/manage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { admin, allocateSlug, json, siteOrigin, isValidHttpUrl, serverError } =
          await import("@/lib/qr-api.server");
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const token = String(body.dashboard_token ?? "");
          const action = String(body.action ?? "");
          if (!token || token.length < 12) return json({ error: "Invalid token" }, 400);

          const db = await admin();
          const { data: tracked } = await db
            .from("tracked_qrs")
            .select("id, slug")
            .eq("dashboard_token", token)
            .maybeSingle();
          if (!tracked) return json({ error: "Not found" }, 404);

          const patch: {
            slug?: string;
            is_active?: boolean;
            expires_at?: string | null;
            target_url?: string;
          } = {};

          if (action === "regenerate_slug") {
            const slug = await allocateSlug(db);
            if (!slug) return json({ error: "Could not allocate slug" }, 500);
            patch.slug = slug;
          } else if (action === "set_active") {
            patch.is_active = Boolean(body.is_active);
          } else if (action === "set_target") {
            const raw = String(body.target_url ?? "").trim();
            const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
            if (!raw || normalized.length > 2048 || !isValidHttpUrl(normalized)) {
              return json({ error: "Invalid target URL" }, 400);
            }
            patch.target_url = normalized;
          } else if (action === "set_expiry") {
            if (body.expires_at === null) patch.expires_at = null;
            else {
              const d = new Date(String(body.expires_at));
              if (isNaN(d.getTime())) return json({ error: "Invalid expires_at" }, 400);
              patch.expires_at = d.toISOString();
            }
          } else {
            return json({ error: "Unknown action" }, 400);
          }

          const { data, error } = await db
            .from("tracked_qrs")
            .update(patch)
            .eq("id", tracked.id)
            .select(
              "id, slug, dashboard_token, target_type, target_url, label, created_at, is_active, expires_at",
            )
            .single();

          if (error || !data) return json({ error: "Update failed" }, 500);

          return json({
            ...data,
            redirect_url: `${siteOrigin(request)}/api/public/r/${data.slug}`,
          });
        } catch (e) {
          console.error(e);
          return serverError(e);
        }
      },
    },
  },
});

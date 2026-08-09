import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/qr/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { admin, allocateSlug, isValidHttpUrl, json, randomId, siteOrigin, serverError } =
          await import("@/lib/qr-api.server");
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const target_type = String(body.target_type ?? "").slice(0, 32);
          const target_url = String(body.target_url ?? "");
          const label = body.label ? String(body.label).slice(0, 200) : null;
          const requestedDomain = body.custom_domain
            ? String(body.custom_domain).toLowerCase().slice(0, 253)
            : null;

          if (!target_type || !target_url) {
            return json({ error: "target_type and target_url required" }, 400);
          }
          if (!isValidHttpUrl(target_url)) {
            return json({ error: "target_url must be a valid http(s) URL" }, 400);
          }

          const db = await admin();

          // Attach the authenticated user when a valid bearer token is present.
          let user_id: string | null = null;
          const authHeader = request.headers.get("Authorization");
          if (authHeader?.startsWith("Bearer ")) {
            const { data } = await db.auth.getUser(authHeader.slice(7));
            if (data.user) user_id = data.user.id;
          }

          // A branded domain is only honoured when the caller owns it and it
          // has passed DNS verification.
          let custom_domain: string | null = null;
          if (requestedDomain && user_id) {
            const { data: owned } = await db
              .from("custom_domains")
              .select("domain")
              .eq("user_id", user_id)
              .eq("domain", requestedDomain)
              .eq("status", "verified")
              .maybeSingle();
            if (!owned) return json({ error: "That domain is not verified for your account" }, 403);
            custom_domain = owned.domain;
          }

          const slug = await allocateSlug(db);
          if (!slug) return json({ error: "Could not allocate slug" }, 500);

          const { data, error } = await db
            .from("tracked_qrs")
            .insert({
              slug,
              dashboard_token: randomId(24),
              target_type,
              target_url,
              label,
              user_id,
              custom_domain,
            })
            .select(
              "id, slug, dashboard_token, target_type, target_url, label, custom_domain, created_at",
            )
            .single();

          if (error || !data) {
            console.error("insert tracked_qr failed", error);
            return json({ error: "Failed to create tracked QR" }, 500);
          }

          const base = custom_domain ? `https://${custom_domain}` : siteOrigin(request);
          return json({ ...data, redirect_url: `${base}/api/public/r/${slug}` });
        } catch (e) {
          console.error(e);
          return serverError(e);
        }
      },
    },
  },
});

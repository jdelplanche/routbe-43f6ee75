import { createFileRoute } from "@tanstack/react-router";
import { missingSecretResponse } from "@/lib/api-secrets";

/** Stripe webhook: only a confirmed payment activates a verified profile. */
export const Route = createFileRoute("/api/public/verify/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return missingSecretResponse();

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();
        if (!(await verifyStripeSignature(body, signature, secret))) {
          return new Response("Invalid signature", { status: 401 });
        }

        const { HANDLED_EVENTS, applyStripeEvent } = await import("@/lib/stripe-events.server");

        let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!event.id) return new Response("Bad request", { status: 400 });
        if (!event.type || !(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
          return new Response("ok (ignored)");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const monitor = supabaseAdmin.from("webhook_events");

        // Idempotency: the Stripe event id is the primary key. A replay of an
        // already-succeeded event is a no-op; a replay after a failure is
        // reprocessed, so Stripe's retries can still repair a broken run.
        const { data: seen } = await monitor
          .select("id, status, attempts" as "*")
          .eq("id", event.id)
          .maybeSingle();
        const previous = (seen ?? null) as { status?: string; attempts?: number } | null;
        if (previous?.status === "success") return new Response("ok (duplicate)");

        const attempts = Number(previous?.attempts ?? 0) + 1;
        const marker = {
          id: event.id,
          source: "stripe",
          kind: event.type,
          status: "processing",
          idempotency_key: request.headers.get("idempotency-key") ?? event.id,
          attempts,
          payload: event as unknown,
          error: null,
        };

        const { error: markerError } = await monitor.upsert(marker as never, { onConflict: "id" });
        if (markerError) {
          // A concurrent delivery won the insert race: let Stripe retry later.
          if (markerError.code === "23505") return new Response("ok (duplicate)");
          console.error("webhook marker failed", markerError);
          return new Response("Server error", { status: 500 });
        }

        try {
          const outcome = await applyStripeEvent(event);
          await monitor
            .update({
              status: "success",
              outcome,
              error: null,
              processed_at: new Date().toISOString(),
            } as never)
            .eq("id", event.id);
          return new Response(`ok (${outcome})`);
        } catch (error) {
          const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
          console.error("stripe webhook failed", event.type, error);
          await monitor
            .update({
              status: "failed",
              error: detail.slice(0, 4000),
              processed_at: new Date().toISOString(),
            } as never)
            .eq("id", event.id);
          // 500 makes Stripe retry; the row above stays retryable.
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});

async function verifyStripeSignature(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=")];
    }),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${body}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

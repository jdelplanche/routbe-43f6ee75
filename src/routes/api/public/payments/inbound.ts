/**
 * Inbound e-mail webhook — automated SEPA payment listener.
 *
 * ImprovMX forwards `payments@rout.be` here as a raw JSON payload. The body of
 * the bank notification (Wise / Bunq) is scanned for a `ROUT-XXXX` reference;
 * a match flips the matching profile to paid + Early Believer, writes an
 * `AUTO_PAYMENT_VERIFIED` audit entry and lets the DB trigger queue the
 * @rout.be alias, which is drained immediately.
 *
 * The ImprovMX API key and the webhook token are read from the server
 * environment only — never from client code.
 */
import { createFileRoute } from "@tanstack/react-router";
import { missingSecretResponse } from "@/lib/api-secrets";

const REFERENCE_RE = /ROUT-\d{4}/i;

/** Pulls every plausible text field out of an unknown inbound-mail payload. */
function collectText(payload: unknown, depth = 0): string {
  if (depth > 6) return "";
  if (typeof payload === "string") return ` ${payload}`;
  if (Array.isArray(payload)) return payload.map((v) => collectText(v, depth + 1)).join(" ");
  if (payload && typeof payload === "object") {
    return Object.values(payload as Record<string, unknown>)
      .map((v) => collectText(v, depth + 1))
      .join(" ");
  }
  return "";
}

export const Route = createFileRoute("/api/public/payments/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["INBOUND_EMAIL_TOKEN"];
        if (!token) return missingSecretResponse();

        const url = new URL(request.url);
        const provided =
          url.searchParams.get("token") ?? request.headers.get("x-inbound-token") ?? "";
        if (provided !== token) return new Response("Unauthorized", { status: 401 });

        const raw = await request.text();
        if (raw.trim().length === 0) {
          return new Response("Bad Request", { status: 400 });
        }

        let parsed: unknown = raw;
        const contentType = request.headers.get("content-type") ?? "";
        try {
          parsed = JSON.parse(raw);
        } catch {
          // ImprovMX may post form-encoded or raw MIME — the text scan covers those.
          // A payload that *claims* to be JSON but is not, is malformed.
          if (contentType.includes("json")) {
            return new Response("Bad Request", { status: 400 });
          }
        }

        const haystack = `${raw} ${collectText(parsed)}`;

        // Idempotency key: the reference when present, otherwise a hash of the
        // payload so a redelivered "amount only" mail is not graded twice.
        const reference = haystack.match(REFERENCE_RE)?.[0]?.toUpperCase() ?? null;
        const fingerprint =
          reference ??
          `body:${[...haystack].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7).toString(36)}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: dupe } = await supabaseAdmin
          .from("webhook_events")
          .insert({ id: `inbound:${fingerprint}`, source: "improvmx", kind: "payment_email" });
        if (dupe) {
          if (dupe.code === "23505") {
            return Response.json({ ok: true, reference, duplicate: true });
          }
          console.error("[inbound] webhook_events insert failed", dupe);
          return new Response("Server error", { status: 500 });
        }

        try {
          const { matchInboundPayment } = await import("@/lib/sepa-matching.server");
          const outcome = await matchInboundPayment(haystack);

          // An unknown reference may simply arrive before its payment row: drop
          // the marker so a later delivery can still settle it.
          if (outcome.level === 3 && outcome.reason === "no_match") {
            await supabaseAdmin.from("webhook_events").delete().eq("id", `inbound:${fingerprint}`);
          }

          return Response.json({ ok: true, ...outcome });
        } catch (error) {
          console.error("[inbound] matching failed", error);
          await supabaseAdmin.from("webhook_events").delete().eq("id", `inbound:${fingerprint}`);
          return new Response("Server error", { status: 500 });
        }

      },
    },
  },
});

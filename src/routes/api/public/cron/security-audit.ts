import { createFileRoute } from "@tanstack/react-router";
import { isMissingSecretError, missingSecretResponse } from "@/lib/api-secrets";

/**
 * Scheduled security audit (call daily with `x-cron-secret`).
 * Audits API keys/tokens, RLS coverage signals and abnormal scan bursts,
 * and writes findings to the security_events alert log.
 */
export const Route = createFileRoute("/api/public/cron/security-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => runAudit(request),
      GET: async ({ request }) => runAudit(request),
    },
  },
});

async function runAudit(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return missingSecretResponse();
  if (request.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
  try {
    ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
    // Touch the client so a missing service-role key fails here, not mid-audit.
    void supabaseAdmin.from;
  } catch (error) {
    if (isMissingSecretError(error)) return missingSecretResponse();
    throw error;
  }
  const events: {
    user_id: string | null;
    kind: string;
    severity: "info" | "warning" | "critical";
    message: string;
    details: Record<string, string | number | boolean | null>;
  }[] = [];

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();

  // 1. Stale / never-used API keys are a leak risk.
  const { data: keys } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, name, created_at, last_used_at, revoked_at")
    .is("revoked_at", null);

  for (const k of keys ?? []) {
    const lastUsed = k.last_used_at ?? k.created_at;
    if (lastUsed < ninetyDaysAgo) {
      events.push({
        user_id: k.user_id,
        kind: "api_key_stale",
        severity: "warning",
        message: `API key "${k.name}" has been unused for over 90 days — consider revoking it.`,
        details: { api_key_id: k.id, last_used_at: k.last_used_at },
      });
    }
  }

  // 2. Abnormal scan frequency (possible bot traffic) in the last 24h.
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const { data: scans } = await supabaseAdmin
    .from("qr_scans")
    .select("tracked_qr_id")
    .gte("scanned_at", dayAgo)
    .limit(20000);

  const counts = new Map<string, number>();
  for (const s of scans ?? []) {
    const id = s.tracked_qr_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const hot = [...counts.entries()].filter(([, n]) => n >= 1000);
  if (hot.length) {
    const { data: owners } = await supabaseAdmin
      .from("tracked_qrs")
      .select("id, user_id, slug")
      .in(
        "id",
        hot.map(([id]) => id),
      );
    for (const [id, n] of hot) {
      const owner = owners?.find((o) => o.id === id);
      events.push({
        user_id: owner?.user_id ?? null,
        kind: "scan_anomaly",
        severity: n >= 5000 ? "critical" : "warning",
        message: `Unusual scan volume (${n} in 24h) on /${owner?.slug ?? id} — possible bot traffic.`,
        details: { tracked_qr_id: id, scans_24h: n },
      });
    }
  }

  // 3. RLS effectiveness probe: the anon Data API must never expose payments.
  try {
    const res = await fetch(
      `${process.env["SUPABASE_URL"]}/rest/v1/verification_payments?select=id&limit=1`,
      {
        headers: {
          apikey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "",
        },
      },
    );
    const rows = res.ok ? ((await res.json()) as unknown[]) : [];
    if (res.ok && Array.isArray(rows) && rows.length > 0) {
      events.push({
        user_id: null,
        kind: "rls_probe_failed",
        severity: "critical",
        message: "Anonymous read of verification_payments returned rows — RLS policy regression.",
        details: { table: "verification_payments" },
      });
    }
  } catch {
    // Probe failures are non-fatal for the audit run.
  }

  if (events.length) await supabaseAdmin.from("security_events").insert(events);

  return new Response(JSON.stringify({ ok: true, findings: events.length }), {
    headers: { "content-type": "application/json" },
  });
}

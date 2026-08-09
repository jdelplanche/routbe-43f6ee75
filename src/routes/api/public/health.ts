import { createFileRoute } from "@tanstack/react-router";

/** Lightweight availability probe used by the footer status widget. */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        let database: "ok" | "degraded" = "ok";
        try {
          const { admin } = await import("@/lib/qr-api.server");
          const db = await admin();
          const { error } = await db.from("tracked_qrs").select("id").limit(1);
          if (error) database = "degraded";
        } catch {
          database = "degraded";
        }
        return new Response(
          JSON.stringify({
            status: database === "ok" ? "operational" : "degraded",
            database,
            latency_ms: Date.now() - startedAt,
            checked_at: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

/**
 * AT Protocol handle verification for wildcard subdomains: a Bluesky crawler
 * asking https://<handle>.rout.be/.well-known/atproto-did gets the stored DID.
 */
export const Route = createFileRoute("/.well-known/atproto-did")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
          },
        }),
      GET: async ({ request }) => {
        const { subdomainFromHost, lookupSubdomainProfile } =
          await import("@/lib/subdomain.server");
        const sub = subdomainFromHost(request.headers.get("host"));
        const cors = {
          "access-control-allow-origin": "*",
          "cache-control": "no-cache",
        };
        if (!sub) return new Response("Not found", { status: 404, headers: cors });

        try {
          const profile = await lookupSubdomainProfile(sub);
          if (!profile?.subdomain_enabled || !profile.bluesky_did) {
            return new Response("Not found", { status: 404, headers: cors });
          }
          return new Response(profile.bluesky_did, {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              ...cors,
            },
          });
        } catch {
          return new Response("Server error", { status: 500, headers: cors });
        }
      },
    },
  },
});

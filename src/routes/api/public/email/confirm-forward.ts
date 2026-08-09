import { createFileRoute } from "@tanstack/react-router";

/**
 * Public double opt-in landing: the member opens this link from the inbox they
 * want their `@rout.be` alias to forward to. Consuming the token confirms the
 * address and provisions the alias.
 */
function page(title: string, body: string, status: number) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — ROUT</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#faf9f7;color:#111}main{max-width:32rem;padding:2rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#555;line-height:1.6}a{color:#111}</style></head><body><main><h1>${title}</h1><p>${body}</p><p><a href="/dashboard">Back to your dashboard</a></p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/email/confirm-forward")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { confirmForwardingToken } = await import("@/lib/forwarding.server");
        const result = await confirmForwardingToken(token);

        if (result.ok) {
          return page(
            "Address confirmed",
            `Mail sent to your ROUT alias will now be forwarded to <strong>${(result.email ?? "").replace(/[<>&]/g, "")}</strong>.`,
            200,
          );
        }
        if (result.reason === "expired") {
          return page(
            "Link expired",
            "This confirmation link is older than 24 hours. Request a new one from your dashboard.",
            410,
          );
        }
        return page(
          "Invalid link",
          "This confirmation link is not valid or has already been used.",
          400,
        );
      },
    },
  },
});

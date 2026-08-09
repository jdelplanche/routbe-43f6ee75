import { createFileRoute } from "@tanstack/react-router";

/**
 * Supabase "Send Email" auth hook.
 *
 * Configure it in Supabase → Authentication → Hooks → Send Email:
 *   URI:    https://rout.be/api/public/auth/send-email
 *   Secret: the value stored as SEND_EMAIL_HOOK_SECRET (v1,whsec_…)
 *
 * Every magic link, sign-up confirmation, recovery and reauthentication mail is
 * then rendered from ROUT's own 4-language templates and sent through Resend
 * from hallo@rout.be, instead of the default Supabase mailer.
 */
export const Route = createFileRoute("/api/public/auth/send-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        const log = (msg: string, extra?: Record<string, unknown>) =>
          console.info(`[auth-email] ${msg}`, { ...extra, ms: Date.now() - started });

        const secret = process.env["SEND_EMAIL_HOOK_SECRET"];
        if (!secret) {
          console.error("[auth-email] SEND_EMAIL_HOOK_SECRET is missing — hook cannot verify");
          return new Response("Hook not configured", { status: 500 });
        }

        const body = await request.text();
        const verified = await verifyStandardWebhook(request, body, secret);
        if (!verified) {
          console.error("[auth-email] signature rejected", {
            hasId: Boolean(request.headers.get("webhook-id")),
            hasTimestamp: Boolean(request.headers.get("webhook-timestamp")),
            hasSignature: Boolean(request.headers.get("webhook-signature")),
            bytes: body.length,
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: HookPayload;
        try {
          payload = JSON.parse(body) as HookPayload;
        } catch (error) {
          console.error("[auth-email] payload is not JSON", error);
          return new Response("Bad request", { status: 400 });
        }

        const email = payload.user?.email;
        const data = payload.email_data;
        if (!email || !data) {
          console.error("[auth-email] payload missing user email or email_data", {
            hasEmail: Boolean(email),
            hasData: Boolean(data),
          });
          return new Response("Bad request", { status: 400 });
        }

        log("hook received", { action: data.email_action_type, recipient: redact(email) });

        const { asNotificationLocale, authEmailAction, authEmailCopy, renderAuthEmail } =
          await import("@/lib/auth-email-templates");
        const { sendResendEmail } = await import("@/lib/notifications.server");

        const meta = payload.user?.user_metadata ?? {};
        const locale = asNotificationLocale(meta["locale"] ?? meta["language"]);
        const action = authEmailAction(data.email_action_type);
        const copy = authEmailCopy(action, locale);

        // The verification endpoint lives on the Supabase auth server, not on
        // the app domain: `redirect_to` is where the user lands afterwards.
        const authBase = (
          process.env["SUPABASE_URL"] ??
          process.env["ROUT_SUPABASE_URL"] ??
          ""
        ).replace(/\/$/, "");
        if (!authBase) {
          console.error("[auth-email] SUPABASE_URL missing — cannot build verification link");
          return new Response("Hook not configured", { status: 500 });
        }
        const siteUrl = data.site_url ?? process.env["PUBLIC_SITE_URL"] ?? "https://rout.be";
        const redirect = data.redirect_to ?? siteUrl;
        const link = `${authBase}/auth/v1/verify?token=${encodeURIComponent(
          data.token_hash ?? "",
        )}&type=${encodeURIComponent(data.email_action_type ?? "magiclink")}&redirect_to=${encodeURIComponent(
          redirect,
        )}`;

        try {
          const sent = await sendResendEmail({
            to: email,
            subject: copy.subject,
            html: renderAuthEmail(copy, link, data.token ?? null),
          });
          if (!sent) {
            console.error("[auth-email] Resend refused the message", {
              recipient: redact(email),
              action,
              locale,
            });
            return new Response("Mail delivery failed", { status: 500 });
          }
          log("delivered", { recipient: redact(email), action, locale });
          return Response.json({});
        } catch (error) {
          console.error("[auth-email] send threw", {
            recipient: redact(email),
            action,
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response("Mail delivery failed", { status: 500 });
        }
      },

    },
  },
});

interface HookPayload {
  user?: { email?: string; user_metadata?: Record<string, unknown> };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
}

/**
 * Standard Webhooks signature check (the scheme Supabase auth hooks use):
 * HMAC-SHA256 over `${id}.${timestamp}.${body}` with the base64 secret.
 */
async function verifyStandardWebhook(
  request: Request,
  body: string,
  secret: string,
): Promise<boolean> {
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signatures = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;

  // Replay window: five minutes, matching the Standard Webhooks spec.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const raw = secret.replace(/^v1,?/, "").replace(/^whsec_/, "");
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return signatures
    .split(" ")
    .map((part) => part.split(",").pop() ?? "")
    .some((candidate) => timingSafeEqual(candidate, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Logs stay useful without dumping full addresses into the log stream. */
function redact(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

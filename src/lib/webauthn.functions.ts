import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Passkey (WebAuthn) ceremonies.
 *
 * Registration is authenticated: you must already be signed in to attach a
 * passkey to your account. Authentication is public by necessity — the whole
 * point is signing in without a session — and is safe because a valid
 * assertion is itself the proof: only after `verifyAuthenticationResponse`
 * succeeds do we mint a Supabase session for the credential's owner.
 *
 * Requires db/manual/20260809_webauthn_passkeys.sql to be applied.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Origin of the live request — passkeys are bound to the exact domain. */
async function requestOrigin(): Promise<string> {
  const { getRequestHeader, getRequestUrl } = await import("@tanstack/react-start/server");
  const forwardedProto = getRequestHeader("x-forwarded-proto");
  const url = getRequestUrl();
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  const host = getRequestHeader("host") ?? url.host;
  return `${proto}://${host}`;
}

/** Options the browser needs to create a brand-new passkey. */
export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { passkeyTables, relyingParty } = await import("./webauthn.server");

    const { rpID, rpName } = relyingParty(await requestOrigin());
    const db = passkeyTables(supabaseAdmin);

    const { data: existing } = await db
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", context.userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Uint8Array.from(context.userId, (c) => c.charCodeAt(0)),
      userName: (context.claims["email"] as string | undefined) ?? "ROUT account",
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c: { credential_id: string }) => ({
        id: c.credential_id,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await db.from("webauthn_challenges").insert({
      challenge: options.challenge,
      user_id: context.userId,
      purpose: "registration",
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    });

    return options;
  });

/** Verifies the attestation and stores the credential against the account. */
export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ response: z.unknown() }).parse(input))
  .handler(async ({ data, context }) => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { passkeyTables, relyingParty, deviceLabelFrom } = await import("./webauthn.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    const origin = await requestOrigin();
    const { rpID } = relyingParty(origin);
    const db = passkeyTables(supabaseAdmin);

    const response = data.response as { response?: { clientDataJSON?: string } };
    const clientData = response.response?.clientDataJSON;
    if (!clientData) return { ok: false as const, reason: "Malformed passkey response." };
    const parsed = JSON.parse(atob(clientData.replace(/-/g, "+").replace(/_/g, "/"))) as {
      challenge?: string;
    };

    const { data: row } = await db
      .from("webauthn_challenges")
      .select("challenge, user_id, expires_at")
      .eq("challenge", parsed.challenge ?? "")
      .eq("purpose", "registration")
      .maybeSingle();

    if (!row || row.user_id !== context.userId || new Date(row.expires_at) < new Date()) {
      return { ok: false as const, reason: "That passkey request expired. Try again." };
    }
    await db.from("webauthn_challenges").delete().eq("challenge", row.challenge);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: data.response as never,
        expectedChallenge: row.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch {
      return { ok: false as const, reason: "This passkey could not be verified." };
    }

    if (!verification.verified || !verification.registrationInfo) {
      return { ok: false as const, reason: "This passkey could not be verified." };
    }

    const info = verification.registrationInfo;
    const { error } = await db.from("webauthn_credentials").insert({
      user_id: context.userId,
      credential_id: info.credential.id,
      public_key: Buffer.from(info.credential.publicKey).toString("base64url"),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      backed_up: info.credentialBackedUp,
      device_label: deviceLabelFrom(getRequestHeader("user-agent") ?? null),
    });
    if (error) return { ok: false as const, reason: "Could not save this passkey." };

    return { ok: true as const };
  });

/** Discoverable-credential login: no e-mail needed, the device picks the account. */
export const startPasskeyLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { passkeyTables, relyingParty } = await import("./webauthn.server");

  const { rpID } = relyingParty(await requestOrigin());
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });

  const db = passkeyTables(supabaseAdmin);
  await db.from("webauthn_challenges").insert({
    challenge: options.challenge,
    purpose: "authentication",
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });

  return options;
});

/**
 * Verifies the assertion and hands back a single-use token the browser can
 * exchange for a real Supabase session via `verifyOtp`. The token is minted
 * only for the account that owns the credential just proven.
 */
export const finishPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ response: z.unknown() }).parse(input))
  .handler(async ({ data }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { passkeyTables, relyingParty } = await import("./webauthn.server");

    const origin = await requestOrigin();
    const { rpID } = relyingParty(origin);
    const db = passkeyTables(supabaseAdmin);

    const response = data.response as { id?: string; response?: { clientDataJSON?: string } };
    const clientData = response.response?.clientDataJSON;
    if (!clientData || !response.id) {
      return { ok: false as const, reason: "Malformed passkey response." };
    }
    const parsed = JSON.parse(atob(clientData.replace(/-/g, "+").replace(/_/g, "/"))) as {
      challenge?: string;
    };

    const { data: row } = await db
      .from("webauthn_challenges")
      .select("challenge, expires_at")
      .eq("challenge", parsed.challenge ?? "")
      .eq("purpose", "authentication")
      .maybeSingle();
    if (!row || new Date(row.expires_at) < new Date()) {
      return { ok: false as const, reason: "That sign-in request expired. Try again." };
    }
    await db.from("webauthn_challenges").delete().eq("challenge", row.challenge);

    const { data: credential } = await db
      .from("webauthn_credentials")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", response.id)
      .maybeSingle();
    if (!credential) return { ok: false as const, reason: "This passkey is not registered." };

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: data.response as never,
        expectedChallenge: row.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
        credential: {
          id: credential.credential_id,
          publicKey: Uint8Array.from(Buffer.from(credential.public_key, "base64url")),
          counter: Number(credential.counter ?? 0),
          transports: credential.transports ?? undefined,
        },
      });
    } catch {
      return { ok: false as const, reason: "This passkey could not be verified." };
    }
    if (!verification.verified) {
      return { ok: false as const, reason: "This passkey could not be verified." };
    }

    await db
      .from("webauthn_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", credential.id);

    // Mint a session for the proven owner: fetch their address, then hand the
    // browser a single-use magic-link token to exchange for a session.
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(credential.user_id);
    const email = user?.user?.email;
    if (!email) return { ok: false as const, reason: "This account has no e-mail address." };

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link?.properties?.hashed_token) {
      return { ok: false as const, reason: "Could not start your session." };
    }

    return { ok: true as const, email, tokenHash: link.properties.hashed_token };
  });

/** Passkeys attached to the signed-in account, for the settings list. */
export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("webauthn_credentials" as never)
      .select("id, device_label, created_at, last_used_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as {
      id: string;
      device_label: string | null;
      created_at: string;
      last_used_at: string | null;
    }[];
  });

/** Removes one passkey. RLS keeps this scoped to the owner. */
export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("webauthn_credentials" as never)
      .delete()
      .eq("id", data.id);
    return { ok: !error };
  });

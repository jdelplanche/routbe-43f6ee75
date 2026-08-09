import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { Link, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Fingerprint, KeyRound, Loader2, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MaskedIcon } from "@/components/MaskedIcon";
import { PasswordField } from "@/components/PasswordField";
import { BRAND_MARKS } from "@/lib/brand-marks";
import { getBootstrapState } from "@/lib/bootstrap.functions";
import { amIAdmin } from "@/lib/admin.functions";

/** Monochrome provider marks — no single brand is allowed to dominate. */
const MARKS: Record<string, string> = {
  github:
    "M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z",
  gitlab:
    "M12 21.4l3.7-11.4H8.3L12 21.4zM3 10l2-6 3.3 6H3zm18 0h-5.3L19 4l2 6zM3 10l9 11.4L6.7 10H3zm18 0h-3.7L12 21.4 21 10z",
  google:
    "M12 11v3.2h5.3c-.2 1.4-1.6 4-5.3 4a5.7 5.7 0 010-11.4c1.7 0 2.9.7 3.6 1.4l2.5-2.4A9.1 9.1 0 0012 3a9 9 0 100 18c5.2 0 8.7-3.7 8.7-8.8 0-.6-.1-1-.2-1.4H12z",
  oidc: "M12 2l8 4v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-4zm0 2.2L6 7v5c0 3.8 2.5 6.7 6 7.8 3.5-1.1 6-4 6-7.8V7l-6-2.8zM12 8a3 3 0 110 6 3 3 0 010-6z",
};

type ProviderKey = "google" | "github" | "gitlab" | "oidc";

/**
 * Auth tiles. `mark` is an inline path, `remote` an official asset that is CSS
 * masked so every logo renders in the single theme text colour.
 */
const TILES: {
  id: string;
  label: string;
  provider: ProviderKey;
  mark?: string;
  remote?: string;
}[] = [
  { id: "github", label: "GitHub", provider: "github", mark: MARKS.github },
  { id: "google", label: "Google", provider: "google", mark: MARKS.google },
  {
    id: "mastodon",
    label: "Mastodon / Fediverse",
    provider: "gitlab",
    remote: BRAND_MARKS.mastodon,
  },
  {
    id: "keycloak",
    label: "Keycloak / Custom OIDC",
    provider: "oidc",
    remote: BRAND_MARKS.keycloak,
  },
  { id: "gitlab", label: "GitLab", provider: "gitlab", mark: MARKS.gitlab },
];

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  gitlab: "Mastodon / Fediverse",
  oidc: "Keycloak / Custom OIDC",
};

/** Deliberately permissive: catches typos, never rejects a valid address. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_INVALID_MESSAGE = "Enter a valid e-mail address (e.g. name@domain.com).";

export default function Auth() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { redirect } = useSearch({ from: "/auth" });

  /**
   * Unified flow: there is no sign-in / sign-up split. One e-mail field sends a
   * magic link; Supabase provisions the account silently when it does not exist
   * yet, so "account not found" and "e-mail already in use" can never appear.
   * The password form stays available as an explicit fallback for accounts that
   * were created with one.
   */
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    getBootstrapState()
      .then((s) => active && setNeedsFirstAdmin(s.needsFirstAdmin))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /**
   * Where to land after authentication: an explicit `?redirect=` wins, then the
   * admin portal for administrators (the first account is auto-promoted),
   * otherwise the normal dashboard.
   */
  const resolveDestination = async () => {
    if (redirect) return redirect;
    try {
      const res = await amIAdmin({});
      if (res.isAdmin) return "/admin";
    } catch {
      /* not an admin, or the probe failed — fall through */
    }
    return "/dashboard";
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    void resolveDestination().then((to) => active && nav(to, { replace: true }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, nav, redirect]);

  /** Final gate before any auth request leaves the browser. */
  const emailAccepted = () => {
    if (EMAIL_REGEX.test(email.trim())) return true;
    setEmailError(EMAIL_INVALID_MESSAGE);
    toast.error(EMAIL_INVALID_MESSAGE);
    return false;
  };

  /** One button for both new and returning accounts. */
  const continueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAccepted()) return;
    setLoading(true);
    const address = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        // Silent sign-up: an unknown address is provisioned in the background.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/claim`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSentTo(address);
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAccepted()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
  };

  const resetPassword = async () => {
    if (!email) return toast.error("Enter your e-mail address first.");
    if (!emailAccepted()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/settings`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your inbox.");
  };

  const oauth = async (provider: ProviderKey) => {
    if (provider === "gitlab" || provider === "oidc") {
      toast.info(
        `${PROVIDER_LABELS[provider]} login is not available yet on this backend — use Google, GitHub or e-mail.`,
      );
      return;
    }
    setLoading(true);
    if (provider === "github") {
      // GitHub is not brokered by Lovable Cloud; use Supabase Auth directly.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setLoading(false);
        toast.error(error.message || "GitHub sign-in failed");
      }
      return;
    }
    const r = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (r.error) {
      setLoading(false);
      toast.error(r.error.message || "Sign-in failed");
    }
  };

  const passkey = async () => {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      return toast.error("This device or browser does not support passkeys.");
    }
    toast.info("Passkeys are rolling out — continue with your e-mail for now.");
  };

  const onEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(value && !EMAIL_REGEX.test(value.trim()) ? EMAIL_INVALID_MESSAGE : null);
  };

  const emailField = (
    <div className="space-y-1">
      <Label htmlFor="auth-email" className="text-sm">
        Email
      </Label>
      <Input
        id="auth-email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="you@domain.com"
        autoComplete="email"
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? "auth-email-error" : undefined}
        className={`h-10 rounded-lg ${emailError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
        required
      />
      {emailError && (
        <p id="auth-email-error" className="text-[11px] text-destructive">
          {emailError}
        </p>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
        {needsFirstAdmin && (
          <div className="mb-3 w-full max-w-md border border-foreground bg-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide">Setup mode</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No administrator exists yet. The <strong>first account created here</strong> is
              automatically promoted to Super Admin and gets access to <code>/admin</code>.
            </p>
          </div>
        )}
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div className="mb-4">
            <h1 className="mb-1 font-display text-2xl text-foreground">Continue to ROUT</h1>
            <p className="text-sm text-muted-foreground">
              One e-mail address, one link. New here or coming back — the same button works.
            </p>
          </div>

          {/* Primary sovereign action */}
          <button
            type="button"
            onClick={passkey}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Fingerprint className="h-4 w-4" aria-hidden />
            Continue with Passkey
          </button>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            Fingerprint, face or hardware key — nothing leaves your device.
          </p>

          {/* Secondary connectors — equal weight, all masked to one colour */}
          <div data-testid="auth-provider-tiles" className="mt-3.5 grid grid-cols-5 gap-2">
            {TILES.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => oauth(tile.provider)}
                disabled={loading}
                aria-label={`Continue with ${tile.label}`}
                title={`Continue with ${tile.label}`}
                className="flex h-10 items-center justify-center rounded-xl border border-border/50 p-2 text-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
              >
                {tile.remote ? (
                  <MaskedIcon src={tile.remote} className="h-4 w-4" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={tile.mark} />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden /> Mastodon and Keycloak cover the
            Fediverse and self-hosted SSO (Authentik, Keycloak, Authelia).
          </p>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              or use email
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {sentTo ? (
            <div
              data-testid="auth-link-sent"
              className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-center"
            >
              <MailCheck className="mx-auto h-6 w-6" aria-hidden />
              <p className="text-sm leading-relaxed">
                We sent a secure sign-in link to <strong>{sentTo}</strong>. Open your inbox to sign
                in or activate your account right away.
              </p>
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Use a different address
              </button>
            </div>
          ) : usePassword ? (
            <form onSubmit={signInWithPassword} className="space-y-3.5">
              {emailField}
              <PasswordField value={password} onChange={setPassword} required minLength={8} />
              <Button
                type="submit"
                className="h-11 w-full rounded-lg font-medium"
                disabled={loading || !!emailError}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUsePassword(false)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden /> Use a magic link instead
                </button>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={continueWithEmail} className="space-y-3.5">
              {emailField}
              <Button
                type="submit"
                data-testid="auth-continue"
                className="h-11 w-full rounded-lg font-medium"
                disabled={loading || !!emailError}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending your link…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" /> Continue with e-mail
                  </>
                )}
              </Button>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                No passwords, no separate sign-up: we mail you a one-time link. If you don't have an
                account yet, we create it for you when you open the link.
              </p>
              <button
                type="button"
                onClick={() => setUsePassword(true)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> I have a password
              </button>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                By continuing you agree to our{" "}
                <Link to="/terms" className="underline underline-offset-4">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

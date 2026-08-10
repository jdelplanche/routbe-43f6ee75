import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  deletePasskey,
  finishPasskeyRegistration,
  listPasskeys,
  startPasskeyRegistration,
} from "@/lib/webauthn.functions";

interface PasskeyRow {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "never";

/**
 * Settings card: register a new passkey and manage the ones already attached
 * to the account. Deletes are RLS-scoped to the owner server-side.
 */
export function PasskeysPanel() {
  const [keys, setKeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setKeys((await listPasskeys()) as PasskeyRow[]);
      setError(null);
    } catch (err) {
      console.error("[passkeys] list failed", err);
      setError(err instanceof Error ? err.message : "Could not load your passkeys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("This device or browser does not support passkeys.");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const options = await startPasskeyRegistration();
      const attestation = await startRegistration({ optionsJSON: options as never });
      const result = await finishPasskeyRegistration({ data: { response: attestation } });
      if (!result.ok) {
        setError(result.reason ?? "This passkey could not be registered.");
        toast.error(result.reason ?? "This passkey could not be registered.");
        return;
      }
      toast.success("Passkey added");
      await refresh();
    } catch (err) {
      console.error("[passkeys] registration failed", err);
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Registration was cancelled."
          : err instanceof Error
            ? err.message
            : "Something went wrong adding this passkey.";
      setError(message);
      toast.error(message);
    } finally {
      setRegistering(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      const res = await deletePasskey({ data: { id } });
      if (!res.ok) throw new Error("Delete was refused.");
      setKeys((rows) => rows.filter((r) => r.id !== id));
      toast.success("Passkey removed");
    } catch (err) {
      console.error("[passkeys] delete failed", err);
      toast.error(err instanceof Error ? err.message : "Could not remove that passkey.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Fingerprint className="h-4 w-4" /> Passkeys
        </h2>
        <Button onClick={add} disabled={registering} className="h-10 gap-2">
          {registering ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {registering ? "Registering…" : "Add a passkey"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Sign in with Face ID, Touch ID, Windows Hello or a security key — no e-mail round trip.
      </p>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading passkeys…
          </p>
        ) : keys.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            No passkeys registered yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {key.device_label || "Passkey"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {fmt(key.created_at)} · last used {fmt(key.last_used_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
                  disabled={removing === key.id}
                  onClick={() => remove(key.id)}
                  aria-label={`Remove ${key.device_label || "passkey"}`}
                >
                  {removing === key.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

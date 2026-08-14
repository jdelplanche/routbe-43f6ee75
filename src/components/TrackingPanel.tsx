import { errorMessage } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy,
  BarChart3,
  Loader2,
  X,
  ExternalLink,
  Globe,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QRType } from "./QRTypeSelector";

export interface TrackedQR {
  id: string;
  slug: string;
  dashboard_token: string;
  target_type: string;
  target_url: string;
  label: string | null;
  redirect_url: string;
  created_at: string;
}

interface TrackingPanelProps {
  qrType: QRType;
  targetUrl: string; // resolved URL for the current QR (empty if not ready)
  tracked: TrackedQR | null;
  onTrackedChange: (t: TrackedQR | null) => void;
}

const TRACKABLE_TYPES: QRType[] = ["url", "image", "pdf", "mp3", "app"];

function localHistoryKey() {
  return "qr_tracking_history_v1";
}

export function addToHistory(t: TrackedQR) {
  try {
    const raw = localStorage.getItem(localHistoryKey());
    const arr: TrackedQR[] = raw ? JSON.parse(raw) : [];
    const filtered = arr.filter((x) => x.slug !== t.slug);
    filtered.unshift(t);
    localStorage.setItem(localHistoryKey(), JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // ignore
  }
}

function normalizeUrl(v: string): string {
  const trimmed = v.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Which link a copy action targets. */
type CopyField = "short" | "stats";
type CopyState = { field: CopyField | null; state: "idle" | "copying" | "copied" | "error" };

export function TrackingPanel({ qrType, targetUrl, tracked, onTrackedChange }: TrackingPanelProps) {
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  // Verified branded domains this user may publish links on.
  const [domains, setDomains] = useState<{ domain: string; is_default: boolean }[]>([]);
  const [domainChoice, setDomainChoice] = useState<string>("default");
  const [copyState, setCopyState] = useState<CopyState>({ field: null, state: "idle" });
  // Screen-reader announcement for copy success/failure.
  const [announcement, setAnnouncement] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const { data } = await supabase
        .from("custom_domains")
        .select("domain, is_default")
        .eq("status", "verified")
        .order("is_default", { ascending: false });
      if (cancelled || !data) return;
      setDomains(data);
      const preferred = data.find((d) => d.is_default);
      if (preferred) setDomainChoice(preferred.domain);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isTrackable = TRACKABLE_TYPES.includes(qrType);
  const ready = targetUrl.trim().length > 0;

  if (!isTrackable) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        Tracking is available for URL, image, PDF, MP3 and App links. Wi-Fi, text, email and SMS QRs
        are decoded directly by the scanner and can't be redirected.
      </div>
    );
  }

  const handleCreate = async () => {
    const normalized = normalizeUrl(targetUrl);
    if (!normalized) {
      toast.error("Add a link or upload a file first");
      return;
    }
    setLoading(true);
    setCreateError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const resp = await fetch("/api/public/qr/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          target_type: qrType,
          target_url: normalized,
          label: label || null,
          custom_domain: domainChoice === "default" ? null : domainChoice,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? "Failed to create tracked link");
      if (!data?.slug) throw new Error("Bad response");
      const t = data as TrackedQR;
      onTrackedChange(t);
      addToHistory(t);
      toast.success("Trackable QR ready");
    } catch (e: unknown) {
      console.error(e);
      toast.error(errorMessage(e, "Failed to create tracked link"));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onTrackedChange(null);
    setLabel("");
  };

  const copy = async (field: CopyField, value: string, label: string) => {
    setCopyState({ field, state: "copying" });
    try {
      await navigator.clipboard.writeText(value);
      setCopyState({ field, state: "copied" });
      setAnnouncement(`${label} copied to clipboard`);
      toast.success(`${label} copied`);
      window.setTimeout(
        () => setCopyState((s) => (s.field === field ? { field: null, state: "idle" } : s)),
        2000,
      );
    } catch (e) {
      setCopyState({ field, state: "error" });
      setAnnouncement(`Copying the ${label.toLowerCase()} failed. Use the retry button.`);
      toast.error(`Couldn't copy the ${label.toLowerCase()}. ${errorMessage(e, "Try again.")}`);
    }
  };

  if (tracked) {
    const statsPath = `/stats/${tracked.dashboard_token}`;
    const statsUrl = `${origin}${statsPath}`;

    const copyButton = (field: CopyField, value: string, label: string) => {
      const active = copyState.field === field ? copyState.state : "idle";
      const Icon =
        active === "copying" ? Loader2 : active === "copied" ? Check : active === "error" ? RotateCcw : Copy;
      return (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={active === "copying"}
          onClick={() => void copy(field, value, label)}
          aria-label={
            active === "error"
              ? `Retry copying ${label.toLowerCase()}`
              : active === "copied"
                ? `${label} copied`
                : `Copy ${label.toLowerCase()}`
          }
        >
          <Icon className={`w-4 h-4 ${active === "copying" ? "animate-spin" : ""}`} aria-hidden />
        </Button>
      );
    };

    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium">Tracking enabled</span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" aria-hidden /> Remove
          </button>
        </div>

        <div className="space-y-1">
          <label htmlFor="tracked-short-link" className="block text-xs text-muted-foreground">
            Short link (encoded in QR)
          </label>
          <div className="flex gap-2">
            <Input
              id="tracked-short-link"
              readOnly
              value={tracked.redirect_url}
              className="h-10 text-xs font-mono"
              aria-describedby="tracked-short-link-hint"
            />
            {copyButton("short", tracked.redirect_url, "Short link")}
            <Button
              asChild
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              <a
                href={tracked.redirect_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open short link in a new tab"
              >
                <ExternalLink className="w-4 h-4" aria-hidden />
              </a>
            </Button>
          </div>
          <p id="tracked-short-link-hint" className="text-[11px] text-muted-foreground">
            {copyState.field === "short" && copyState.state === "error"
              ? "Copying failed — your browser blocked clipboard access. Retry, or select the field and copy manually."
              : "This is the URL encoded in your QR. Every scan is counted before the redirect."}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="tracked-stats-link" className="block text-xs text-muted-foreground">
            Private stats link (save it!)
          </label>
          <div className="flex gap-2">
            <Input
              id="tracked-stats-link"
              readOnly
              value={statsUrl}
              className="h-10 text-xs font-mono"
              aria-describedby="tracked-stats-link-hint"
            />
            {copyButton("stats", statsUrl, "Stats link")}
          </div>
          <p id="tracked-stats-link-hint" className="text-[11px] text-muted-foreground">
            {copyState.field === "stats" && copyState.state === "error"
              ? "Copying failed — retry, or select the field and copy manually."
              : "Anyone with this link can view scan stats. There's no way to recover it if lost."}
          </p>
        </div>

        <RouterLink
          to={statsPath}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          Open dashboard <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </RouterLink>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-foreground" />
        <span className="text-sm font-medium">Track scans</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Route this QR through a short link so we can count every scan. You'll get a private stats
        dashboard.
      </p>
      <Input
        placeholder="Label (optional, e.g. 'Poster v1')"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-10"
      />
      {domains.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Link domain
          </p>
          <Select value={domainChoice} onValueChange={setDomainChoice}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">ROUT default domain</SelectItem>
              {domains.map((d) => (
                <SelectItem key={d.domain} value={d.domain}>
                  {d.domain}
                  {d.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        type="button"
        onClick={handleCreate}
        disabled={!ready || loading}
        className="w-full h-10"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create trackable QR"}
      </Button>
      {!ready && (
        <p className="text-[11px] text-muted-foreground">
          Add a link or upload a file to enable tracking.
        </p>
      )}
    </div>
  );
}

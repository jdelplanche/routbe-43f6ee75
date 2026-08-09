import { errorMessage } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, BarChart3, Loader2, X, ExternalLink, Globe } from "lucide-react";
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

export function TrackingPanel({ qrType, targetUrl, tracked, onTrackedChange }: TrackingPanelProps) {
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  // Verified branded domains this user may publish links on.
  const [domains, setDomains] = useState<{ domain: string; is_default: boolean }[]>([]);
  const [domainChoice, setDomainChoice] = useState<string>("default");

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

  const copy = async (v: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success(msg);
    } catch {
      toast.error("Copy failed");
    }
  };

  if (tracked) {
    const statsPath = `/stats/${tracked.dashboard_token}`;
    const statsUrl = `${window.location.origin}${statsPath}`;
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium">Tracking enabled</span>
          </div>
          <button
            onClick={handleRemove}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Short link (encoded in QR)</p>
          <div className="flex gap-2">
            <Input readOnly value={tracked.redirect_url} className="h-10 text-xs font-mono" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => copy(tracked.redirect_url, "Short link copied")}
              aria-label="Copy short link"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Private stats link (save it!)</p>
          <div className="flex gap-2">
            <Input readOnly value={statsUrl} className="h-10 text-xs font-mono" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => copy(statsUrl, "Stats link copied")}
              aria-label="Copy stats link"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Anyone with this link can view scan stats. There's no way to recover it if lost.
          </p>
        </div>

        <RouterLink
          to={statsPath}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          Open dashboard <ExternalLink className="w-3.5 h-3.5" />
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

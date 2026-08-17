import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Download, Loader2, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { getHubAnalytics } from "@/lib/hub-analytics.functions";
import type { HubAnalytics as HubAnalyticsData } from "@/lib/hub-analytics.server";
import { BLOCK_KINDS, type ProfileBlock } from "@/lib/profile";
import { downloadCsv, toCsv } from "@/lib/csv";

interface Props {
  /** Blocks of the current hub — used to resolve a click kind to its label. */
  blocks: ProfileBlock[];
  /** Range in days, or null for all time. */
  days: number | null;
  /** Handle used in the exported filename. */
  handle: string;
}

function Bars({
  title,
  rows,
  empty,
  label,
}: {
  title: string;
  rows: { key: string; count: number }[];
  empty: string;
  label: (key: string) => string;
}) {
  const max = rows[0]?.count || 1;
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium">{label(row.key)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Real, cookieless hub analytics: views, clicks per link, referrers, export. */
export function HubAnalytics({ blocks, days, handle }: Props) {
  const fetchAnalytics = useServerFn(getHubAnalytics);
  const [data, setData] = useState<HubAnalyticsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = (await fetchAnalytics({ data: { days } })) as HubAnalyticsData;
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchAnalytics, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const labelForKind = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of BLOCK_KINDS) map.set(k.kind, k.label);
    for (const b of blocks) if (b.label) map.set(b.kind, b.label);
    return (kind: string) => map.get(kind) ?? kind;
  }, [blocks]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ...data.series.map((p) => ({ section: "daily", key: p.date, views: p.views, clicks: p.clicks })),
      ...data.clicksByKind.map((r) => ({
        section: "clicks_per_link",
        key: labelForKind(r.key),
        views: "",
        clicks: r.count,
      })),
      ...data.referrers.map((r) => ({
        section: "referrer",
        key: r.key,
        views: r.count,
        clicks: "",
      })),
      ...data.devices.map((r) => ({ section: "device", key: r.key, views: r.count, clicks: "" })),
    ];
    downloadCsv(
      `rout-hub-analytics-${handle || "profile"}.csv`,
      toCsv(rows, ["section", "key", "views", "clicks"]),
    );
  };

  const exportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rout-hub-analytics-${handle || "profile"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs"
      >
        <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
        <span className="flex-1">Could not load hub analytics.</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Profile hub — views &amp; clicks</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            CSV
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={exportJson}>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Profile views", value: String(data.views) },
          { label: "Link clicks", value: String(data.clicks) },
          { label: "Click-through rate", value: `${data.ctr}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border p-3">
            <p className="text-2xl font-medium tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Views vs clicks</p>
        {data.series.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No hub activity recorded in this timeframe yet.
          </p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="hubViewFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="currentColor"
                  fill="url(#hubViewFill)"
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="currentColor"
                  strokeDasharray="4 3"
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Bars
          title="Clicks per link"
          rows={data.clicksByKind}
          empty="No link clicks recorded yet."
          label={labelForKind}
        />
        <Bars
          title="Top referrers"
          rows={data.referrers}
          empty="No referrers recorded yet."
          label={(k) => (k === "direct" ? "Direct / no referrer" : k)}
        />
      </div>

      <Bars
        title="Devices"
        rows={data.devices}
        empty="No device data yet."
        label={(k) => k.charAt(0).toUpperCase() + k.slice(1)}
      />
    </div>
  );
}

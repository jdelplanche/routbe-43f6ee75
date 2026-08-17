/**
 * Aggregations for the Profile Hub analytics panel.
 *
 * Reads `analytics_events` as the signed-in owner (RLS: profile_id = auth.uid()).
 * Rows are cookieless and aggregated already: a `profile_view` stores the
 * referrer host, a `link_click` reuses the referrer column to store the block
 * kind that was clicked.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface HubAnalyticsSeriesPoint {
  date: string;
  views: number;
  clicks: number;
}

export interface HubAnalyticsBucket {
  key: string;
  count: number;
}

export interface HubAnalytics {
  views: number;
  clicks: number;
  ctr: number;
  series: HubAnalyticsSeriesPoint[];
  clicksByKind: HubAnalyticsBucket[];
  referrers: HubAnalyticsBucket[];
  devices: HubAnalyticsBucket[];
  lastEventAt: string | null;
}

const EMPTY: HubAnalytics = {
  views: 0,
  clicks: 0,
  ctr: 0,
  series: [],
  clicksByKind: [],
  referrers: [],
  devices: [],
  lastEventAt: null,
};

function rank(map: Map<string, number>, limit: number): HubAnalyticsBucket[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export async function fetchHubAnalytics(
  supabase: SupabaseClient,
  userId: string,
  days: number | null,
): Promise<HubAnalytics> {
  let query = supabase
    .from("analytics_events")
    .select("event_type, referrer, device_type, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(20000);

  if (days) {
    query = query.gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("hub analytics read failed", error.message);
    return EMPTY;
  }

  const rows = (data ?? []) as {
    event_type: string;
    referrer: string | null;
    device_type: string | null;
    created_at: string;
  }[];
  if (!rows.length) return EMPTY;

  const byDay = new Map<string, { views: number; clicks: number }>();
  const kinds = new Map<string, number>();
  const referrers = new Map<string, number>();
  const devices = new Map<string, number>();
  let views = 0;
  let clicks = 0;

  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    const bucket = byDay.get(day) ?? { views: 0, clicks: 0 };
    if (row.event_type === "link_click") {
      clicks += 1;
      bucket.clicks += 1;
      const kind = row.referrer?.trim() || "link";
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    } else {
      views += 1;
      bucket.views += 1;
      const source = row.referrer?.trim() || "direct";
      referrers.set(source, (referrers.get(source) ?? 0) + 1);
    }
    byDay.set(day, bucket);
    const device = row.device_type?.trim() || "unknown";
    devices.set(device, (devices.get(device) ?? 0) + 1);
  }

  return {
    views,
    clicks,
    ctr: views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0,
    series: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, views: v.views, clicks: v.clicks })),
    clicksByKind: rank(kinds, 12),
    referrers: rank(referrers, 8),
    devices: rank(devices, 4),
    lastEventAt: rows[0]?.created_at ?? null,
  };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner-only: aggregated views/clicks for the signed-in member's link hub. */
export const getHubAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ days: z.number().int().min(1).max(3650).nullable().optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { fetchHubAnalytics } = await import("./hub-analytics.server");
    return fetchHubAnalytics(context.supabase, context.userId, data.days ?? null);
  });

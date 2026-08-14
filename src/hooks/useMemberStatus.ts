import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getMemberStatus, type MemberStatus } from "@/lib/membership.functions";

/**
 * Live membership snapshot (Early Believer badge, blue mark, verification).
 *
 * Errors are surfaced instead of swallowed so the UI can show a retry, and the
 * query re-syncs automatically whenever the member's profile row changes in the
 * backend — a verification approval flips the blue check without a reload.
 */
export function useMemberStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = ["member-status", userId ?? "anon"];

  const query = useQuery<MemberStatus>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
    queryFn: () => getMemberStatus(),
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`member-status-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["member-status", userId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

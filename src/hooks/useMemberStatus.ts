import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getMemberStatus, type MemberStatus } from "@/lib/membership.functions";

/**
 * Live membership snapshot (Early Believer badge, blue mark, verification).
 * Returns null while signed out, so public surfaces can render the generic copy.
 */
export function useMemberStatus() {
  const { user } = useAuth();

  return useQuery<MemberStatus | null>({
    queryKey: ["member-status", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getMemberStatus();
      } catch {
        return null;
      }
    },
  });
}

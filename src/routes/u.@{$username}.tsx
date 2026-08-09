import { useEffect } from "react";
import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ProfileMissing, ProfileView } from "@/components/profile/ProfileView";
import { ProfileSuspended } from "@/components/profile/ProfileSuspended";
import { useProfileRecord } from "@/hooks/useProfileRecord";

export const Route = createFileRoute("/u/@{$username}")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ROUT community profile" },
      {
        name: "description",
        content: "A free ROUT community link hub — every channel behind one handle.",
      },
      { property: "og:title", content: "ROUT community profile" },
      { property: "og:description", content: "A free ROUT community link hub." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: FreeProfile,
});

function FreeProfile() {
  const { username } = useParams({ from: "/u/@{$username}" });
  // Normalise: strip a leading @ so /u/@john and /u/john resolve identically.
  const handle = username.replace(/^@/, "").toLowerCase();
  const { profile, suspended, loading } = useProfileRecord(handle);

  useEffect(() => {
    if (profile) document.title = `${profile.display_name || `@${profile.username}`} — ROUT`;
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return <ProfileMissing username={handle} free />;

  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={handle} />;
  }

  return <ProfileView profile={profile} free />;
}


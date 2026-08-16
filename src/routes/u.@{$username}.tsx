import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileMissing, ProfileView } from "@/components/profile/ProfileView";
import { ProfileSuspended } from "@/components/profile/ProfileSuspended";
import { getPublicProfile } from "@/lib/public-profile.functions";
import { profileHead } from "@/lib/profile-head";

export const Route = createFileRoute("/u/@{$username}")({
  loader: ({ params }) => getPublicProfile({ data: { username: params.username } }),
  head: ({ params, loaderData }) =>
    profileHead(params.username.replace(/^@/, "").toLowerCase(), loaderData, { free: true }),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: FreeProfile,
});

function FreeProfile() {
  const { username } = Route.useParams();
  const { profile, suspended } = Route.useLoaderData();
  // Normalise: strip a leading @ so /u/@john and /u/john resolve identically.
  const handle = username.replace(/^@/, "").toLowerCase();

  if (!profile) return <ProfileMissing username={handle} free />;

  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={handle} />;
  }

  return <ProfileView profile={profile} free style={profile.style} />;
}

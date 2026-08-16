import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ProfileMissing, ProfileView } from "@/components/profile/ProfileView";
import { ProfileSuspended } from "@/components/profile/ProfileSuspended";
import { getPublicProfile } from "@/lib/public-profile.functions";
import { profileHead } from "@/lib/profile-head";

export const Route = createFileRoute("/@{$username}")({
  loader: ({ params }) => getPublicProfile({ data: { username: params.username } }),
  head: ({ params, loaderData }) =>
    profileHead(params.username.replace(/^@/, "").toLowerCase(), loaderData),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: PublicProfile,
});

function PublicProfile() {
  const { username } = Route.useParams();
  const { profile, suspended } = Route.useLoaderData();
  const handle = username.replace(/^@/, "").toLowerCase();

  if (!profile) return <ProfileMissing username={handle} />;

  // Moderation: a suspended profile is never rendered publicly.
  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={handle} />;
  }

  // Paid / verified namespace: free profiles live under /u/handle.
  if (!profile.verified || profile.status !== "active") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <h1 className="font-display text-2xl">@{handle} is a community profile</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The verified namespace is reserved for verified accounts. This handle lives in the free
          community namespace.
        </p>
        <Link
          to="/u/{$username}"
          params={{ username: handle }}
          className="mt-2 text-sm font-medium underline"
        >
          Go to rout.be/u/{handle} →
        </Link>
      </div>
    );
  }

  return <ProfileView profile={profile} style={profile.style} />;
}

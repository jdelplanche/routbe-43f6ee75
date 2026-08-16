import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ProfileMissing, ProfileView } from "@/components/profile/ProfileView";
import { ProfileSuspended } from "@/components/profile/ProfileSuspended";
import { getPublicProfile } from "@/lib/public-profile.functions";
import { profileHead } from "@/lib/profile-head";
import { useI18n } from "@/lib/i18n";

/**
 * Clean namespace: `rout.be/<handle>` is reserved for verified members.
 * Unverified handles keep living under `/u/<handle>` so the root namespace
 * never collides with product routes. Server-rendered for SEO and social cards.
 */
export const Route = createFileRoute("/$username")({
  loader: ({ params }) => getPublicProfile({ data: { username: params.username } }),
  head: ({ params, loaderData }) =>
    profileHead(params.username.replace(/^@/, "").toLowerCase(), loaderData),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: CleanProfile,
});

function CleanProfile() {
  const { username } = Route.useParams();
  const { profile, suspended } = Route.useLoaderData();
  const { t } = useI18n();
  const handle = username.replace(/^@/, "").toLowerCase();

  if (!profile) return <ProfileMissing username={handle} />;

  if (suspended || profile.status === "suspended" || profile.status === "banned") {
    return <ProfileSuspended username={handle} />;
  }

  if (!profile.verified || profile.status !== "active") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <h1 className="font-display text-2xl">{t("profile.ns.title", { handle })}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("profile.ns.body")}</p>
        <Link
          to="/u/{$username}"
          params={{ username: handle }}
          className="mt-2 text-sm font-medium underline"
        >
          {t("profile.ns.cta", { handle })}
        </Link>
      </div>
    );
  }

  return <ProfileView profile={profile} style={profile.style} />;
}

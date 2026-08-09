import { useEffect } from "react";
import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { storeReferrer } from "@/lib/referral";
import { trackReferralVisit } from "@/lib/monitoring.functions";
import { useI18n } from "@/lib/i18n";

/**
 * Referral landing: `rout.be/r/<handle>`. Tags the visitor with the inviter and
 * forwards them to that member's profile, where the sign-up CTA lives.
 */
export const Route = createFileRoute("/r/$username")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "You were invited to ROUT" },
      {
        name: "description",
        content: "Claim your own sovereign handle, link hub and QR codes on ROUT.",
      },
      { property: "og:title", content: "You were invited to ROUT" },
      {
        property: "og:description",
        content: "Claim your own sovereign handle, link hub and QR codes on ROUT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: ReferralLanding,
});

function ReferralLanding() {
  const { username } = useParams({ from: "/r/$username" });
  const navigate = useNavigate();
  const { t } = useI18n();
  const handle = username.replace(/^@/, "").toLowerCase();

  useEffect(() => {
    storeReferrer(handle);
    // Analytics for the inviter's dashboard; never blocks the redirect.
    void trackReferralVisit({
      data: { handle, referer: typeof document !== "undefined" ? document.referrer : undefined },
    }).catch(() => undefined);
    void navigate({ to: "/$username", params: { username: handle }, replace: true });
  }, [handle, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{t("referral.landing", { handle })}</p>
    </div>
  );
}

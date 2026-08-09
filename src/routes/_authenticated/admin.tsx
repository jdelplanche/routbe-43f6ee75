import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import Admin from "@/pages/Admin";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — ROUT" },
      {
        name: "description",
        content: "Internal ROUT admin tools: manual verification approval and handle overrides.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin — ROUT" },
      { property: "og:description", content: "Internal ROUT admin tools." },
    ],
  }),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: Admin,
});

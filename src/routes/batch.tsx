import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";
import Batch from "@/pages/Batch";

export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "Batch QR codes — ROUT" },
      {
        name: "description",
        content: "Generate hundreds of QR codes at once from a CSV and download them as a ZIP.",
      },
      { property: "og:title", content: "Batch QR-codes — ROUT" },
      {
        property: "og:description",
        content: "Generate hundreds of QR codes at once from a CSV.",
      },
      ...socialImageMeta,
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      canonicalMeta("/batch"),
    ],
    links: [canonicalLink("/batch")],
  }),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: Batch,
});

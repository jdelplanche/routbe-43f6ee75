import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ROUT — Indie QR Code Studio" },
      {
        name: "description",
        content:
          "Create print-ready QR codes with custom styling, frames, SEPA/IBAN payments and scan analytics. Free and fast.",
      },
      { property: "og:title", content: "ROUT — Indie QR Code Studio" },
      {
        property: "og:description",
        content:
          "Print-ready QR codes with granular styling, frames, IBAN payments and scan analytics.",
      },
      ...socialImageMeta,
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      canonicalMeta("/"),
    ],
    links: [canonicalLink("/")],
  }),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: Index,
});

import { createFileRoute } from "@tanstack/react-router";
import Domains from "@/pages/Domains";
import { requireFeature } from "@/lib/entitlement-guard";

export const Route = createFileRoute("/_authenticated/dashboard/domains")({
  beforeLoad: () => requireFeature("domains"),
  head: () => ({
    meta: [
      { title: "Custom domains — ROUT" },
      {
        name: "description",
        content:
          "Connect your own domain so every dynamic QR link is branded with your name instead of ours.",
      },
      { property: "og:title", content: "Custom domains — ROUT" },
      { property: "og:description", content: "Brand your dynamic QR links with your own domain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Domains,
});

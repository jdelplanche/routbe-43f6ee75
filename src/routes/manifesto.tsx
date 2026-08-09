import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import Manifesto from "@/pages/Manifesto";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "The ROUT manifesto — Why a QR generator needs a point of view" },
      {
        name: "description",
        content:
          "The four principles behind ROUT: sovereign infrastructure, open source, no stealth tracking and codes that outlive us.",
      },
      { property: "og:title", content: "The ROUT manifesto" },
      { property: "og:description", content: "Why a QR generator needs a point of view." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      ...socialImageMeta,
    ],
  }),
  component: Manifesto,
});

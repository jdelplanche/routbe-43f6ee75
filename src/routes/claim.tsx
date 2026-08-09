import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import Claim from "@/pages/Claim";

export const Route = createFileRoute("/claim")({
  head: () => ({
    meta: [
      { title: "Claim your handle — ROUT" },
      {
        name: "description",
        content:
          "Check availability and claim your rout.be handle: one identity for your profile, links and e-mail alias.",
      },
      { property: "og:title", content: "Claim your handle — ROUT" },
      {
        property: "og:description",
        content: "Check and claim your rout.be handle in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...socialImageMeta,
    ],
  }),
  component: Claim,
});

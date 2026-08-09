import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import Contact from "@/pages/Contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Support — ROUT" },
      {
        name: "description",
        content:
          "Neem contact op met ROUT: algemene vragen, bugrapporten of custom domains en enterprise-infrastructuur.",
      },
      { property: "og:title", content: "Contact & Support — ROUT" },
      {
        property: "og:description",
        content: "Vragen, bugs of samenwerkingen — we lezen elk bericht.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...socialImageMeta,
    ],
  }),
  component: Contact,
});

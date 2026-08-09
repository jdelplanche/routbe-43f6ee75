import { createFileRoute } from "@tanstack/react-router";
import RoutesManager from "@/pages/RoutesManager";

export const Route = createFileRoute("/_authenticated/dashboard/routes")({
  head: () => ({
    meta: [
      { title: "Routes & e-mail — ROUT" },
      {
        name: "description",
        content:
          "Manage your claimed handle, your active QR routes and short links, and your linked e-mail addresses.",
      },
      { property: "og:title", content: "Routes & e-mail — ROUT" },
      {
        property: "og:description",
        content: "Manage your handle, routes and linked e-mail addresses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutesManager,
});

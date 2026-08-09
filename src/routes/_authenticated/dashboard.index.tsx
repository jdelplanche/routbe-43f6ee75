import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/Dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ROUT" },
      {
        name: "description",
        content:
          "Manage your saved QR codes, short links and aggregated scan analytics in one place.",
      },
      { property: "og:title", content: "Dashboard — ROUT" },
      { property: "og:description", content: "Manage your QR codes, profile and links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

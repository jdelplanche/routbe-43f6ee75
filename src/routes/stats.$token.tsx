import { createFileRoute } from "@tanstack/react-router";
import Stats from "@/pages/Stats";

export const Route = createFileRoute("/stats/$token")({
  head: () => ({
    meta: [
      { title: "Scan analytics — ROUT" },
      {
        name: "description",
        content: "See real-time scans, countries and devices for your dynamic QR code.",
      },
      { property: "og:title", content: "Scan analytics — ROUT" },
      {
        property: "og:description",
        content: "Real-time scans, countries and devices for your dynamic QR code.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Stats,
});

import { createFileRoute } from "@tanstack/react-router";
import Stats from "@/pages/Stats";

export const Route = createFileRoute("/stats/$token")({
  head: () => ({
    meta: [
      { title: "Scanstatistieken — ROUT" },
      {
        name: "description",
        content: "Bekijk realtime scans, landen en toestellen van je dynamische QR-code.",
      },
      { property: "og:title", content: "Scanstatistieken — ROUT" },
      {
        property: "og:description",
        content: "Realtime scans, landen en toestellen van je dynamische QR-code.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Stats,
});

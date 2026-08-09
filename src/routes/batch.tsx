import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import Batch from "@/pages/Batch";

export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "Batch QR-codes — ROUT" },
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
    ],
  }),
  component: Batch,
});

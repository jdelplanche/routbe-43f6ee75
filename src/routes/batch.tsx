import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import Batch from "@/pages/Batch";

export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "Batch QR-codes — ROUT" },
      {
        name: "description",
        content: "Genereer honderden QR-codes in één keer vanuit een CSV en download ze als ZIP.",
      },
      { property: "og:title", content: "Batch QR-codes — ROUT" },
      {
        property: "og:description",
        content: "Genereer honderden QR-codes in één keer vanuit een CSV.",
      },
      ...socialImageMeta,
    ],
  }),
  component: Batch,
});

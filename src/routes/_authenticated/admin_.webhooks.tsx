import { createFileRoute } from "@tanstack/react-router";
import AdminWebhooks from "@/pages/AdminWebhooks";

export const Route = createFileRoute("/_authenticated/admin_/webhooks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Webhook monitor — ROUT admin" },
      {
        name: "description",
        content: "Monitor every Stripe and SEPA webhook delivery, with payloads and error traces.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Webhook monitor — ROUT admin" },
      { property: "og:description", content: "Internal ROUT webhook monitoring." },
    ],
  }),
  component: AdminWebhooks,
});

import { createFileRoute } from "@tanstack/react-router";
import AccountSettings from "@/pages/AccountSettings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & security — ROUT" },
      {
        name: "description",
        content:
          "Manage your e-mail, password, sessions and developer access for your ROUT account.",
      },
      { property: "og:title", content: "Settings & security — ROUT" },
      { property: "og:description", content: "Account, security and developer access settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountSettings,
});

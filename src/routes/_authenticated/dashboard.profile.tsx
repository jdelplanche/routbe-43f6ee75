import { createFileRoute } from "@tanstack/react-router";
import ProfileSettings from "@/pages/ProfileSettings";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ROUT" },
      {
        name: "description",
        content: "Manage your public ROUT handle, display name, tagline, bio and avatar.",
      },
      { property: "og:title", content: "Profile — ROUT" },
      {
        property: "og:description",
        content: "Manage your public handle and profile details on ROUT.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileSettings,
});

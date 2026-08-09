import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/pages/Auth";

export type AuthSearch = { mode?: "signin" | "signup"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search.mode === "signup" ? "signup" : search.mode === "signin" ? "signin" : undefined,
    // Only same-origin paths may be used as a post-login destination.
    redirect:
      typeof search.redirect === "string" && /^\/(?!\/)/.test(search.redirect)
        ? search.redirect
        : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Inloggen — ROUT" },
      {
        name: "description",
        content: "Log in of maak een ROUT-account om je QR-codes te bewaren en te volgen.",
      },
      { property: "og:title", content: "Inloggen — ROUT" },
      {
        property: "og:description",
        content: "Log in of maak een ROUT-account om je QR-codes te bewaren.",
      },
    ],
  }),
  component: Auth,
});

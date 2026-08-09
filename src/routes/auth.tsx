import { canonicalLink, canonicalMeta } from "@/lib/site";
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
      { title: "Sign in — ROUT" },
      {
        name: "description",
        content: "Sign in or create a ROUT account to save and track your QR codes.",
      },
      { property: "og:title", content: "Sign in — ROUT" },
      {
        property: "og:description",
        content: "Sign in or create a ROUT account to save your QR codes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      canonicalMeta("/auth"),
    ],
    links: [canonicalLink("/auth")],
  }),
  component: Auth,
});

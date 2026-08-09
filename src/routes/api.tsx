import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import DeveloperHub from "@/pages/DeveloperHub";

export const Route = createFileRoute("/api")({
  head: () => ({
    meta: [
      { title: "API & MCP endpoints — ROUT" },
      {
        name: "description",
        content:
          "API keys, rate limits, MCP tools and copy-paste quickstart snippets for the ROUT QR platform.",
      },
      { property: "og:title", content: "API & MCP endpoints — ROUT" },
      { property: "og:description", content: "API keys, MCP tools and quickstart snippets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...socialImageMeta,
    ],
  }),
  component: DeveloperHub,
});

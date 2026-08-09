import { noindexMeta } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { SubdomainPanel } from "@/components/dashboard/SubdomainPanel";
import { BlueskyWizard } from "@/components/dashboard/BlueskyWizard";
import { requireFeature } from "@/lib/entitlement-guard";

export const Route = createFileRoute("/_authenticated/dashboard/bluesky")({
  beforeLoad: () => requireFeature("bluesky"),
  head: () => ({
    meta: [
      { title: "Bluesky handle — ROUT" },
      {
        name: "description",
        content:
          "Use your verified rout.be subdomain as your Bluesky handle, served from your own identity record.",
      },
      { property: "og:title", content: "Bluesky handle — ROUT" },
      {
        property: "og:description",
        content: "Turn your rout.be subdomain into a sovereign Bluesky handle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      noindexMeta,
    ],
  }),
  component: BlueskyPage,
});

function BlueskyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bluesky handle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your rout.be subdomain and use it as your handle on Bluesky.
        </p>
      </header>
      <SubdomainPanel />
      <BlueskyWizard />
    </div>
  );
}

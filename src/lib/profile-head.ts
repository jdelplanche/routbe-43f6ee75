/**
 * Shared head() metadata builder for every public link-hub namespace, so
 * social scrapers get a real title, description, avatar and canonical URL.
 */
import { SITE_ORIGIN } from "@/lib/site";
import type { PublicProfilePayload } from "@/lib/public-profile.server";

export function profileHead(
  handle: string,
  payload: PublicProfilePayload | undefined,
  opts: { free?: boolean } = {},
) {
  const canonical = `${SITE_ORIGIN}/${opts.free ? "u/" : ""}${handle}`;
  const profile = payload?.profile ?? null;

  if (!profile || payload?.suspended) {
    return {
      meta: [
        { title: `@${handle} — ROUT` },
        { name: "robots", content: "noindex" },
        { name: "description", content: `The handle @${handle} is not available on ROUT.` },
        { property: "og:title", content: `@${handle} — ROUT` },
        { property: "og:description", content: "Claim this handle on ROUT." },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  }

  const name = profile.display_name || `@${profile.username}`;
  const description =
    (profile.bio || profile.tagline || "").trim() ||
    `${name} on ROUT — every channel behind one sovereign handle.`;
  const image = profile.avatar_url && /^https:\/\//.test(profile.avatar_url) ? profile.avatar_url : null;

  return {
    meta: [
      { title: `${name} (@${profile.username}) — ROUT` },
      { name: "description", content: description },
      { property: "og:title", content: `${name} (@${profile.username})` },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ...(image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:image", content: image },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: canonical }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name,
          alternateName: `@${profile.username}`,
          description,
          url: canonical,
          ...(image ? { image } : {}),
        }),
      },
    ],
  };
}

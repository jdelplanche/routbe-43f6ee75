import { expect, test } from "@playwright/test";

/**
 * Guards the network identity: every social link in the app must point at an
 * official ROUT account and open safely in a new tab.
 */
const PAGES = ["/", "/api", "/contact", "/manifesto", "/sovereignty", "/privacy", "/terms"];

const NETWORKS = [
  { host: "github.com", expected: /^https:\/\/github\.com\/routbe(\/|$)/ },
  { host: "instagram.com", expected: /^https:\/\/(www\.)?instagram\.com\/rout\.be(\/|$)/ },
  { host: "linkedin.com", expected: /^https:\/\/(www\.)?linkedin\.com\/company\/routbe(\/|$)/ },
  { host: "bsky.app", expected: /^https:\/\/bsky\.app\/profile\/routbe(\/|$)/ },
  { host: "mastodon.social", expected: /^https:\/\/mastodon\.social\/@routbe(\/|$)/ },
];

type LinkInfo = { href: string; target: string | null; rel: string | null };

async function collectLinks(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  return page.$$eval("a[href]", (anchors) =>
    anchors.map((a) => ({
      href: (a as HTMLAnchorElement).href,
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel"),
    })),
  ) as Promise<LinkInfo[]>;
}

test.describe("Social & network links audit", () => {
  test("all social links point at official ROUT accounts and open safely", async ({ page }) => {
    const seen = new Set<string>();
    let checked = 0;

    for (const path of PAGES) {
      const links = await collectLinks(page, path);
      for (const link of links) {
        const network = NETWORKS.find((n) => link.href.includes(n.host));
        if (!network) continue;
        checked += 1;
        seen.add(network.host);

        expect(link.href, `${path} → ${link.href}`).toMatch(network.expected);
        expect(link.target, `${path} → ${link.href} target`).toBe("_blank");
        expect(link.rel ?? "", `${path} → ${link.href} rel`).toContain("noopener");
        expect(link.rel ?? "", `${path} → ${link.href} rel`).toContain("noreferrer");
      }
    }

    expect(checked, "expected social links to be present").toBeGreaterThan(0);
    expect([...seen].sort()).toEqual(
      expect.arrayContaining(["github.com", "instagram.com", "linkedin.com"]),
    );
  });

  test("every external link opening a new tab is rel-hardened", async ({ page }) => {
    for (const path of PAGES) {
      const links = await collectLinks(page, path);
      const risky = links.filter(
        (l) =>
          l.target === "_blank" && l.href.startsWith("http") && !(l.rel ?? "").includes("noopener"),
      );
      expect(risky.map((l) => `${path} → ${l.href}`)).toEqual([]);
    }
  });
});

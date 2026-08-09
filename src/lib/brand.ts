/**
 * Brand intelligence.
 *
 * Given a raw URL (or any value that contains a domain) we try to recognise a
 * well-known brand so the studio can offer its palette + logo in one click.
 * Unknown domains still get a favicon suggestion via a CORS-friendly icon CDN.
 */

export interface BrandSuggestion {
  /** Human label, e.g. "PayPal". */
  name: string;
  /** Bare hostname without www, e.g. "paypal.com". */
  domain: string;
  /** Primary brand colour, used for the QR dots. */
  fgColor: string;
  /** Background colour that stays high-contrast against fgColor. */
  bgColor: string;
  /** Absolute, CORS-enabled logo URL that qr-code-styling can embed. */
  logo: string;
}

/** Curated palettes for brands people scan-to-visit the most. */
const KNOWN_BRANDS: Record<string, { name: string; fg: string; bg: string }> = {
  "delplanche.com": { name: "Delplanche", fg: "#1C1917", bg: "#FAF6F0" },
  "rout.be": { name: "ROUT", fg: "#12261F", bg: "#F2FBF7" },
  "paypal.com": { name: "PayPal", fg: "#003087", bg: "#FFFFFF" },
  "spotify.com": { name: "Spotify", fg: "#1DB954", bg: "#101010" },
  "youtube.com": { name: "YouTube", fg: "#FF0000", bg: "#FFFFFF" },
  "instagram.com": { name: "Instagram", fg: "#C13584", bg: "#FFFFFF" },
  "facebook.com": { name: "Facebook", fg: "#1877F2", bg: "#FFFFFF" },
  "linkedin.com": { name: "LinkedIn", fg: "#0A66C2", bg: "#FFFFFF" },
  "x.com": { name: "X", fg: "#000000", bg: "#FFFFFF" },
  "twitter.com": { name: "X (Twitter)", fg: "#000000", bg: "#FFFFFF" },
  "tiktok.com": { name: "TikTok", fg: "#000000", bg: "#FFFFFF" },
  "whatsapp.com": { name: "WhatsApp", fg: "#25D366", bg: "#FFFFFF" },
  "github.com": { name: "GitHub", fg: "#181717", bg: "#FFFFFF" },
  "airbnb.com": { name: "Airbnb", fg: "#FF5A5F", bg: "#FFFFFF" },
  "booking.com": { name: "Booking.com", fg: "#003580", bg: "#FFFFFF" },
  "amazon.com": { name: "Amazon", fg: "#FF9900", bg: "#131921" },
  "shopify.com": { name: "Shopify", fg: "#5E8E3E", bg: "#FFFFFF" },
  "bol.com": { name: "bol", fg: "#0000A4", bg: "#FFFFFF" },
  "coolblue.be": { name: "Coolblue", fg: "#0090E3", bg: "#FFFFFF" },
  "stripe.com": { name: "Stripe", fg: "#635BFF", bg: "#FFFFFF" },
  "notion.so": { name: "Notion", fg: "#191919", bg: "#FFFFFF" },
  "figma.com": { name: "Figma", fg: "#F24E1E", bg: "#FFFFFF" },
  "pinterest.com": { name: "Pinterest", fg: "#E60023", bg: "#FFFFFF" },
  "twitch.tv": { name: "Twitch", fg: "#9146FF", bg: "#FFFFFF" },
  "reddit.com": { name: "Reddit", fg: "#FF4500", bg: "#FFFFFF" },
  "apple.com": { name: "Apple", fg: "#111111", bg: "#F5F5F7" },
  "microsoft.com": { name: "Microsoft", fg: "#0078D4", bg: "#FFFFFF" },
};

/** Extract a bare hostname from anything that smells like a URL. */
export function extractDomain(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

/** Logo endpoint that serves permissive CORS headers, so canvas export works. */
export function faviconFor(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

/** Best-effort brand match: exact host, then registrable root. */
export function detectBrand(raw: string): BrandSuggestion | null {
  const domain = extractDomain(raw);
  if (!domain) return null;

  const parts = domain.split(".");
  const candidates = [domain];
  for (let i = 1; i < parts.length - 1; i++) candidates.push(parts.slice(i).join("."));

  for (const key of candidates) {
    const hit = KNOWN_BRANDS[key];
    if (hit) {
      return {
        name: hit.name,
        domain: key,
        fgColor: hit.fg,
        bgColor: hit.bg,
        logo: faviconFor(key),
      };
    }
  }

  // Unknown brand — still offer the site's own icon with a neutral palette.
  const label = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return { name: label, domain, fgColor: "#1C1917", bgColor: "#FFFFFF", logo: faviconFor(domain) };
}

export function isKnownBrand(raw: string): boolean {
  const domain = extractDomain(raw);
  if (!domain) return false;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (KNOWN_BRANDS[parts.slice(i).join(".")]) return true;
  }
  return false;
}

/** Slugify anything into a safe, lowercase filename fragment. */
export function slugify(input: string, max = 40): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export interface FilenameSource {
  qrType: string;
  url?: string;
  text?: string;
  wifiSSID?: string;
  emailAddress?: string;
  smsPhone?: string;
  whatsappPhone?: string;
  paymentLabel?: string;
}

/**
 * Derive a descriptive download filename from whatever the user typed:
 * a URL becomes "delplanche-com-qr", a Wi-Fi network becomes "wifi-office-qr".
 */
export function suggestFilename(src: FilenameSource): string {
  const { qrType } = src;

  const fromUrl = (value?: string) => {
    const domain = extractDomain(value ?? "");
    if (domain) return slugify(domain);
    return slugify(value ?? "");
  };

  let core = "";
  switch (qrType) {
    case "url":
    case "image":
    case "pdf":
    case "mp3":
    case "app":
      core = fromUrl(src.url);
      break;
    case "text":
      core = slugify((src.text ?? "").split(/\s+/).slice(0, 5).join(" "), 32);
      break;
    case "wifi":
      core = src.wifiSSID ? `wifi-${slugify(src.wifiSSID, 28)}` : "";
      break;
    case "email":
      core = src.emailAddress ? `email-${slugify(src.emailAddress.split("@")[0], 28)}` : "";
      break;
    case "sms":
      core = src.smsPhone ? `sms-${slugify(src.smsPhone, 20)}` : "";
      break;
    case "whatsapp":
      core = src.whatsappPhone ? `whatsapp-${slugify(src.whatsappPhone, 20)}` : "";
      break;
    default:
      core = slugify(src.paymentLabel ?? qrType, 28);
  }

  if (!core) core = slugify(qrType) || "qrcode";
  return `${core}-qr`;
}

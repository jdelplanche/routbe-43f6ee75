import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, Mail, QrCode, Share2, UserPlus } from "lucide-react";
import { blockHref, themeOf, type ProfileRecord } from "@/lib/profile";
import { SocialPlatformIcon } from "@/lib/social-icons";
import { BadgeShowcase } from "@/components/profile/BadgeShowcase";
import { VerifiedInfoDialog } from "@/components/profile/VerifiedInfoDialog";
import { useI18n } from "@/lib/i18n";
import { trackProfileEvent } from "@/lib/profile-analytics";
import {
  DEFAULT_PROFILE_STYLE,
  backgroundFor,
  fontFamilyFor,
  type ProfileStyle,
} from "@/lib/profile-style";

/** Swaps the browser tab icon for the profile's own favicon (or avatar). */
function useProfileFavicon(url?: string | null) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);
    return () => link.remove();
  }, [url]);
}

/** Builds a downloadable vCard so visitors can save the profile as a contact. */
function vcardFor(profile: ProfileRecord, url: string, email: string | null): string {
  const name = profile.display_name || `@${profile.username}`;
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `NICKNAME:${profile.username ?? ""}`,
    profile.tagline ? `TITLE:${profile.tagline}` : null,
    email ? `EMAIL;TYPE=INTERNET:${email}` : null,
    `URL:${url}`,
    profile.avatar_url ? `PHOTO;VALUE=URI:${profile.avatar_url}` : null,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export interface ProfileViewProps {
  profile: ProfileRecord;
  free?: boolean;
  style?: ProfileStyle;
}

/** Renders a public ROUT link hub for both the /@handle and /u/@handle namespaces. */
export function ProfileView({ profile, free = false, style }: ProfileViewProps) {
  const { t: tr } = useI18n();
  const t = themeOf(profile.theme);
  const s = style ?? DEFAULT_PROFILE_STYLE;
  const blocks = profile.blocks.filter((b) => !b.hidden && b.value.trim());
  const radius = profile.card_style === "pill" ? 999 : 16;
  const earlyBeliever = Boolean(profile.is_early_believer);
  const [showVerifyInfo, setShowVerifyInfo] = useState(false);
  const [shared, setShared] = useState(false);
  const aliasEmail =
    profile.show_email_publicly && earlyBeliever && profile.username
      ? `${profile.username}@rout.be`
      : null;

  useProfileFavicon(profile.favicon_url ?? profile.avatar_url);

  const shareUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? `https://rout.be/${free ? "u/" : ""}${profile.username ?? ""}`
        : window.location.href,
    [free, profile.username],
  );

  // Count one cookieless page view per profile visit.
  useEffect(() => {
    if (!profile.username) return;
    trackProfileEvent({ username: profile.username, type: "view" });
  }, [profile.username]);

  // Keep the mobile browser chrome in sync with the profile theme.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = t.bg;
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [t.bg]);

  const onShare = async () => {
    const title = profile.display_name || `@${profile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const onSaveContact = () => {
    const blob = new Blob([vcardFor(profile, shareUrl, aliasEmail)], { type: "text/vcard" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${profile.username ?? "rout"}.vcf`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const actionStyle = { border: `1px solid ${t.border}`, color: t.text, borderRadius: radius };

  return (
    <main
      className="min-h-screen w-full px-4 py-12"
      style={{ background: backgroundFor(s.background, t.bg, t.border), color: t.text, fontFamily: fontFamilyFor(s.typography) }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name || `@${profile.username}`}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover"
            style={{ border: `1px solid ${t.border}` }}
            fetchPriority="high"
          />
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-medium"
            style={{ background: t.card, border: `1px solid ${t.border}` }}
          >
            {(profile.display_name || profile.username || "R").slice(0, 1).toUpperCase()}
          </div>
        )}

        <h1 className="mt-4 flex items-center gap-1.5 break-words text-center font-display text-2xl">
          {profile.display_name || `@${profile.username}`}
          {profile.verified && (
            <button
              type="button"
              onClick={() => setShowVerifyInfo(true)}
              className="transition-opacity hover:opacity-70"
              aria-label={tr("verifyInfo.open")}
              title={tr("verifyInfo.open")}
            >
              <BadgeCheck
                className={earlyBeliever ? "h-6 w-6" : "h-5 w-5"}
                style={{ color: "#1d9bf0" }}
                aria-hidden
              />
            </button>
          )}
        </h1>
        {earlyBeliever && (
          <button
            type="button"
            onClick={() => setShowVerifyInfo(true)}
            className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ border: `1px solid ${t.border}`, color: t.text }}
          >
            <BadgeCheck className="h-3 w-3" aria-hidden /> Early Believer
          </button>
        )}

        <VerifiedInfoDialog
          open={showVerifyInfo}
          onClose={() => setShowVerifyInfo(false)}
          username={profile.username}
          createdAt={profile.created_at ?? null}
          verified={Boolean(profile.verified)}
          earlyBeliever={earlyBeliever}
        />
        <p className="mt-1 text-center text-sm" style={{ color: t.muted }}>
          {free ? "rout.be/u/@" : "@"}
          {profile.username}
        </p>
        {aliasEmail && (
          <a
            href={`mailto:${aliasEmail}`}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={actionStyle}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden /> Contact via {aliasEmail}
          </a>
        )}
        {(profile.bio || profile.tagline) && (
          <p className="mt-3 max-w-sm text-balance text-center text-sm" style={{ color: t.muted }}>
            {profile.bio || profile.tagline}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-opacity hover:opacity-80"
            style={actionStyle}
          >
            {shared ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Share2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {shared ? "Link copied" : "Share"}
          </button>
          <button
            type="button"
            onClick={onSaveContact}
            className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-opacity hover:opacity-80"
            style={actionStyle}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden /> Save contact
          </button>
          <a
            href={`/?url=${encodeURIComponent(shareUrl)}`}
            className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-opacity hover:opacity-80"
            style={actionStyle}
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden /> QR code
          </a>
        </div>

        <BadgeShowcase userId={profile.id} theme={t} />

        <nav aria-label="Profile links" className="mt-8 flex w-full flex-col gap-3">
          {blocks.length === 0 && (
            <p className="text-center text-sm" style={{ color: t.muted }}>
              No links yet.
            </p>
          )}
          {blocks.map((b) => (
            <a
              key={b.id}
              href={blockHref(b)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                profile.username &&
                trackProfileEvent({ username: profile.username, type: "click", kind: b.kind })
              }
              className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                borderRadius: radius,
                background: profile.card_style === "solid" ? t.text : t.card,
                color: profile.card_style === "solid" ? t.bg : t.text,
                border: profile.card_style === "bordered" ? `1px solid ${t.border}` : "none",
              }}
            >
              <SocialPlatformIcon
                source={blockHref(b) || b.kind}
                className="h-4 w-4 text-current"
              />
              <span className="min-w-0 flex-1 truncate text-center">{b.label}</span>
              <span className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          ))}
        </nav>

        <a
          href="/"
          className="mt-10 text-[11px] uppercase tracking-widest"
          style={{ color: t.muted }}
        >
          Made with ROUT
        </a>
      </div>
    </main>
  );
}

export function ProfileMissing({ username, free }: { username: string; free?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <h1 className="font-display text-2xl">@{username} is still available</h1>
      <p className="text-sm text-muted-foreground">
        This handle has not been claimed {free ? "in the community namespace" : "or verified"} yet.
      </p>
      <a href="/auth?mode=signup" className="mt-2 text-sm font-medium underline">
        Claim it on ROUT →
      </a>
    </div>
  );
}

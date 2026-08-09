import type { SVGProps } from "react";
import { BRAND_MARKS } from "@/lib/brand-marks";
import { cn } from "@/lib/utils";


/** Monochrome brand marks not covered by lucide-react. */

export function BlueskyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      {/* Optical centring: the butterfly bbox sits ~1px high in a 24px box. */}
      <g transform="translate(0 1.05)">
        <path d="M5.77 3.4C8.35 5.34 11.12 9.26 12 11.37c.88-2.11 3.65-6.03 6.23-7.97C20.09 2 23 .95 23 4.27c0 .66-.38 5.57-.6 6.37-.78 2.77-3.6 3.48-6.11 3.05 4.39.75 5.5 3.22 3.09 5.7-4.58 4.7-6.58-1.18-7.09-2.69-.09-.27-.14-.4-.14-.29 0-.11-.05.02-.14.29-.51 1.51-2.51 7.39-7.09 2.69-2.41-2.48-1.3-4.95 3.09-5.7-2.51.43-5.33-.28-6.11-3.05C1.68 9.84 1.3 4.93 1.3 4.27c0-3.32 2.91-2.27 4.47-.87Z" />
      </g>
    </svg>
  );
}

export function MastodonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M21.6 8.9c0-4.2-2.7-5.4-2.7-5.4C17.5 2.8 15.1 2.5 12.6 2.5h-.06c-2.5 0-4.9.3-6.3.99 0 0-2.7 1.2-2.7 5.4 0 1 0 2.1.03 3.4.1 4.2.8 8.4 4.7 9.4 1.8.5 3.4.6 4.6.5 2.3-.1 3.5-.8 3.5-.8l-.07-1.7s-1.6.5-3.4.4c-1.8-.06-3.6-.2-3.9-2.4a4 4 0 0 1-.04-.6s1.7.4 3.9.5c1.3.06 2.6-.08 3.9-.24 2.5-.3 4.7-1.85 5-3.27.4-2.24.4-5.47.4-5.47Zm-3.3 5.5h-2.05V9.4c0-1.06-.45-1.6-1.35-1.6-1 0-1.5.64-1.5 1.9v2.76h-2.03V9.7c0-1.26-.5-1.9-1.5-1.9-.9 0-1.35.54-1.35 1.6v5h-2.06V9.25c0-1.06.27-1.9.82-2.52a2.8 2.8 0 0 1 2.16-.94c1.02 0 1.8.39 2.31 1.17l.51.86.51-.86c.51-.78 1.29-1.17 2.31-1.17.88 0 1.6.31 2.16.94.55.62.82 1.46.82 2.52v5.15Z" />
    </svg>
  );
}

/**
 * Eyou — official brand mark.
 *
 * Rendered as a plain <img> instead of a CSS mask: cross-origin mask images
 * are subject to CORS and silently fail, which showed up as a broken/blank
 * mark. The URL is the canonical, hardcoded brand asset and must never be
 * swapped for a preview-host, placeholder or locally downloaded copy.
 */
export function EyouIcon({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_MARKS.eyou}
      alt="Eyou"
      loading="lazy"
      decoding="async"
      className={cn("inline-block shrink-0 object-contain", className)}
    />
  );
}


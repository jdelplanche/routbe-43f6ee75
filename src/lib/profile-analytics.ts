/**
 * Fire-and-forget, cookieless analytics beacons for the public link hub.
 * Never blocks navigation and never throws.
 */
type Payload = { username: string; type: "view" | "click"; kind?: string };

export function trackProfileEvent(payload: Payload): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/public/profile/event",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/public/profile/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics must never break the page */
  }
}

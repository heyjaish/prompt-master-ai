// Silent event tracker — fire and forget, never blocks UI
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "admin-secret-2025";

export type AnalyticsEvent =
  | "specialist_activated" | "specialist_created" | "specialist_edited"
  | "prompt_generated"     | "prompt_rated_up"    | "prompt_rated_down"
  | "chip_clicked"         | "template_clicked"   | "image_uploaded"
  | "split_view_opened"    | "history_opened"     | "error_occurred"
  | "session_start"        | "copy_clicked"       | "enhance_again";

export interface TrackPayload {
  uid:      string;
  event:    AnalyticsEvent;
  metadata?: Record<string, string | number | boolean>;
}

export function trackEvent(payload: TrackPayload): void {
  // Fire and forget — never await this
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: getSessionId() }),
  }).catch(() => {}); // silent
}

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("pm_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem("pm_sid", sid); }
  return sid;
}

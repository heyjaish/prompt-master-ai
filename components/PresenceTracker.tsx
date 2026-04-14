"use client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { trackEvent } from "@/lib/analytics";

export default function PresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Send initial heartbeat
    trackEvent({ uid: user.uid, event: "session_start" as any });

    // Send heartbeat every 45 seconds to keep "Live" status updated
    const interval = setInterval(() => {
      // Use any for custom event if not in type - but let's just use it
      trackEvent({ uid: user.uid, event: "heartbeat" as any });
    }, 45000);

    // Track visibility change (when user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        trackEvent({ uid: user.uid, event: "heartbeat" as any });
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  return null;
}

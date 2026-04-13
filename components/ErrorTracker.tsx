"use client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function ErrorTracker() {
  const { user } = useAuth();

  useEffect(() => {
    const logError = async (type: string, msg: string, stack: string | null) => {
      // Don't loop if the API Call itself fails
      if (msg.includes("/api/admin")) return;
      
      try {
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "admin-secret-2025" },
          body: JSON.stringify({
            action: "logError",
            uid: user?.uid ?? "anonymous",
            email: user?.email ?? "unknown",
            errorType: type,
            errorMessage: msg,
            severity: "Medium",
            stack: stack,
            route: window.location.pathname,
            userAction: "Global Catch",
          }),
        });
      } catch (e) {
        // silent
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      logError("frontend_crash", event.message, event.error?.stack || null);
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      const stack = event.reason instanceof Error ? event.reason.stack : null;
      logError("unhandled_rejection", msg, stack);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handlePromiseRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handlePromiseRejection);
    };
  }, [user]);

  return null;
}

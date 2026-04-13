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
      const stack = event.reason instanceof Error ? (event.reason.stack || null) : null;
      logError("unhandled_rejection", msg, stack);
    };

    // Intercept window.fetch to capture API Errors locally
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0] instanceof Request ? args[0].url : "";
      
      try {
        const response = await originalFetch(...args);
        if (!response.ok && !url.includes("/api/admin")) {
          // If we can clone the response, let's try to get the error message
          let errMsg = `HTTP ${response.status} ${response.statusText}`;
          try {
            const clone = response.clone();
            const text = await clone.text();
            if (text) errMsg += ` - ${text.slice(0, 500)}`;
          } catch {}
          
          let errorType = "api_error";
          if (response.status === 401 || response.status === 403) errorType = "invalid_key";
          if (response.status === 429) errorType = "rate_limit";
          
          logError(errorType, `Endpoint: ${url}\nError: ${errMsg}`, null);
        }
        return response;
      } catch (err) {
        if (!url.includes("/api/admin")) {
          const msg = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? (err.stack || null) : null;
          logError(msg.includes("timeout") ? "timeout" : "api_error", `Endpoint: ${url}\nNetwork Error: ${msg}`, stack);
        }
        throw err;
      }
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handlePromiseRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handlePromiseRejection);
      window.fetch = originalFetch;
    };
  }, [user]);

  return null;
}

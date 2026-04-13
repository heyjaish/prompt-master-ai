"use client";
import { useEffect } from "react";
import { logFrontendError } from "@/lib/error-logger";
import { AlertCircle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logFrontendError({
      errorType: "react_global_error_boundary",
      errorMessage: error.message,
      stack: error.stack,
      severity: "Critical",
      userAction: "Global App Crash",
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#09090d", color: "#f0f0f5", fontFamily: "sans-serif" }}>
        <div style={{
          height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: 12,
            background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <AlertCircle size={24} color="#f87171" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Fatal Application Error</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", maxWidth: 400, lineHeight: 1.5 }}>
              A critical error occurred while loading the application.
            </p>
          </div>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer",
              fontSize: 13, fontWeight: 600, marginTop: 10
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

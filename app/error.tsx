"use client";
import { useEffect } from "react";
import { logFrontendError } from "@/lib/error-logger";
import { AlertCircle } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logFrontendError({
      errorType: "react_error_boundary",
      errorMessage: error.message,
      stack: error.stack,
      severity: "Critical",
      userAction: "Page Crash",
    });
  }, [error]);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 16
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 12,
        background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <AlertCircle size={24} color="#f87171" />
      </div>
      <div style={{ textAlign: "center", color: "var(--tx-1)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ fontSize: 13, color: "var(--tx-3)", maxWidth: 400, lineHeight: 1.5 }}>
          An unexpected error caused the application to crash. The development team has been notified.
        </p>
      </div>
      <button
        onClick={() => reset()}
        style={{
          padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)", color: "var(--tx-1)", cursor: "pointer",
          fontSize: 13, fontWeight: 600, marginTop: 10
        }}
      >
        Try again
      </button>
    </div>
  );
}

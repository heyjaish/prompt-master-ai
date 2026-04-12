"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Zap, Loader2, AlertTriangle } from "lucide-react";

function SSOCallback() {
  const [status, setStatus] = useState("Connecting to Skillsark…");
  const [error,  setError]  = useState("");
  const router  = useRouter();
  const params  = useSearchParams();

  useEffect(() => {
    const code = params.get("sso_code");
    if (!code) {
      setError("No SSO code received. Please try signing in again.");
      return;
    }

    (async () => {
      try {
        // Step 1: exchange code with our API (server-side)
        setStatus("Verifying your Skillsark identity…");
        const res = await fetch("/api/sso-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok || !data.customToken) {
          throw new Error(data.error ?? "Exchange failed");
        }

        // Step 2: sign into Firebase with the custom token
        setStatus("Signing you in…");
        if (!auth) throw new Error("Firebase auth not configured");
        await signInWithCustomToken(auth, data.customToken);

        // Step 3: done!
        router.replace("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      }
    })();
  }, [params, router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)",
      backgroundImage: "radial-gradient(ellipse at 40% 50%, rgba(99,102,241,.1) 0%, transparent 60%)",
    }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        background: "rgba(23,23,29,0.9)", backdropFilter: "blur(24px)",
        border: "1px solid var(--border-lg)", borderRadius: "var(--r5)",
        padding: "40px 36px", maxWidth: 360, width: "90%",
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: error ? "rgba(239,68,68,.12)" : "rgba(99,102,241,.15)",
          border: `1px solid ${error ? "rgba(239,68,68,.3)" : "rgba(99,102,241,.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {error
            ? <AlertTriangle size={22} color="#f87171" />
            : <Loader2 size={22} className="spin" color="#818cf8" />
          }
        </div>

        {error ? (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f87171", marginBottom: 6 }}>Sign-in failed</div>
              <div style={{ fontSize: 13, color: "var(--tx-3)", lineHeight: 1.6 }}>{error}</div>
            </div>
            <button
              onClick={() => router.replace("/login")}
              style={{
                padding: "9px 24px", borderRadius: "var(--r2)",
                background: "var(--accent)", color: "#fff",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", marginBottom: 6 }}>
                Skillsark SSO
              </div>
              <div style={{ fontSize: 13, color: "var(--tx-3)" }}>{status}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0,1,2].map(i => (
                <span key={i} className="dot" style={{ animationDelay: `${i * .2}s` }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense>
      <SSOCallback />
    </Suspense>
  );
}

"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

function SSOCallback() {
  const [status, setStatus] = useState("Connecting to Skillsark…");
  const [phase,  setPhase]  = useState<"loading" | "success" | "error">("loading");
  const [error,  setError]  = useState("");
  const router  = useRouter();
  const params  = useSearchParams();

  useEffect(() => {
    const code = params.get("sso_code");
    if (!code) {
      setError("No SSO code received. Please try signing in again.");
      setPhase("error");
      return;
    }

    (async () => {
      try {
        // Step 1: exchange code with our server-side API
        setStatus("Verifying your Skillsark identity…");
        const res  = await fetch("/api/sso-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "SSO exchange failed");
        }

        // Step 2a: Firebase Admin configured → sign in with custom token
        if (data.customToken) {
          setStatus("Signing you into Firebase…");
          if (!auth) throw new Error("Firebase auth not initialized. Check NEXT_PUBLIC_FIREBASE_* env vars.");
          await signInWithCustomToken(auth, data.customToken);
          setPhase("success");
          setTimeout(() => router.replace("/"), 800);
          return;
        }

        // Step 2b: No Admin SDK → show what user data was returned
        if (data.noAdmin) {
          throw new Error(
            `Skillsark identity verified (${data.user?.name} / ${data.user?.email}) but Firebase custom token could not be created.\n\nFix: Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY to your Vercel environment variables (get them from Firebase Console → Service Accounts → Generate new private key).`
          );
        }

        throw new Error("Unexpected response from SSO exchange.");

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sign-in failed";
        setError(msg);
        setPhase("error");
      }
    })();
  }, [params, router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: "24px",
      backgroundImage: "radial-gradient(ellipse at 40% 50%, rgba(99,102,241,.1) 0%, transparent 60%)",
    }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        background: "rgba(23,23,29,0.9)", backdropFilter: "blur(24px)",
        border: "1px solid var(--border-lg)", borderRadius: "var(--r5)",
        padding: "40px 36px", maxWidth: 420, width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: phase === "error"   ? "rgba(239,68,68,.12)"
                    : phase === "success" ? "rgba(34,197,94,.12)"
                    : "rgba(99,102,241,.15)",
          border: `1px solid ${phase === "error" ? "rgba(239,68,68,.3)" : phase === "success" ? "rgba(34,197,94,.3)" : "rgba(99,102,241,.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {phase === "loading" && <Loader2 size={22} className="spin" color="#818cf8" />}
          {phase === "success" && <CheckCircle size={22} color="#4ade80" />}
          {phase === "error"   && <AlertTriangle size={22} color="#f87171" />}
        </div>

        {/* Content */}
        {phase === "loading" && (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", marginBottom: 6 }}>Skillsark SSO</div>
              <div style={{ fontSize: 13, color: "var(--tx-3)" }}>{status}</div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#818cf8",
                  animation: "pulse 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </>
        )}

        {phase === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#4ade80", marginBottom: 6 }}>Signed in!</div>
            <div style={{ fontSize: 13, color: "var(--tx-3)" }}>Redirecting to app…</div>
          </div>
        )}

        {phase === "error" && (
          <>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f87171", marginBottom: 10 }}>Sign-in Failed</div>
              <div style={{
                fontSize: 12.5, color: "var(--tx-3)", lineHeight: 1.7,
                background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)",
                borderRadius: "var(--r2)", padding: "10px 12px",
                textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {error}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => router.replace("/login")} style={{
                padding: "8px 20px", borderRadius: "var(--r2)",
                background: "var(--bg-card)", border: "1px solid var(--border-lg)",
                color: "var(--tx-2)", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
                ← Back to Login
              </button>
              <button onClick={() => { setPhase("loading"); setError(""); window.location.reload(); }} style={{
                padding: "8px 20px", borderRadius: "var(--r2)",
                background: "var(--accent)", color: "#fff",
                border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                Retry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <Loader2 size={24} className="spin" color="var(--accent-fg)" />
      </div>
    }>
      <SSOCallback />
    </Suspense>
  );
}

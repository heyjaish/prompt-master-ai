"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Zap, Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const { user }  = useAuth();
  const router    = useRouter();

  useEffect(() => { if (user) router.replace("/"); }, [user, router]);

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        setError("Sign-in failed. Please try again.");
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: "24px 16px",
      backgroundImage: `
        radial-gradient(ellipse at 20% 50%, rgba(123,104,238,.12) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 10%, rgba(59,130,246,.08) 0%, transparent 50%),
        radial-gradient(ellipse at 60% 90%, rgba(168,85,247,.06) 0%, transparent 45%)
      `,
    }}>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>

        {/* Logo mark */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 18px",
            background: "linear-gradient(135deg, rgba(123,104,238,.25), rgba(123,104,238,.05))",
            border: "1px solid var(--accent-brd)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 32px rgba(123,104,238,.2)",
          }}>
            <Zap size={24} color="var(--accent-fg)" />
          </div>

          <h1 style={{
            fontSize: 26, fontWeight: 700, color: "var(--tx-1)",
            letterSpacing: "-.025em", lineHeight: 1.2, marginBottom: 8,
          }}>
            Prompt Master AI
          </h1>
          <p style={{ fontSize: 14, color: "var(--tx-2)", lineHeight: 1.6 }}>
            Engineer perfect prompts for any AI model
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {["🎭 Role-play", "🌐 Context-rich", "📋 Structured", "🖼️ Vision", "⚡ Instant copy"].map(f => (
            <span key={f} style={{
              fontSize: 11.5, color: "var(--tx-3)",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              padding: "3px 10px", borderRadius: "var(--rf)",
            }}>{f}</span>
          ))}
        </div>

        {/* Auth card */}
        <div style={{
          width: "100%",
          background: "rgba(23,23,29,0.85)",
          backdropFilter: "blur(24px)",
          border: "1px solid var(--border-lg)",
          borderRadius: "var(--r5)",
          padding: "28px 24px",
          boxShadow: "0 24px 64px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 6 }}>
              <Sparkles size={13} color="var(--accent-fg)" />
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--accent-fg)" }}>
                Free to use
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--tx-2)" }}>
              Sign in to start engineering prompts
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "13px 20px",
              borderRadius: "var(--r3)",
              background: loading ? "var(--bg-card)" : "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-lg)",
              color: "var(--tx-1)", fontSize: 15, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all .2s",
              boxShadow: "0 2px 12px rgba(0,0,0,.3)",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.4)"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "var(--border-lg)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,.3)"; }}
          >
            {loading ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? "Opening Google…" : "Continue with Google"}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: "var(--r2)",
              background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
              fontSize: 13, color: "#f87171", textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* Terms */}
          <p style={{ fontSize: 11.5, color: "var(--tx-3)", textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>
            By continuing, you agree to our Terms of Service.<br />
            Your data is saved securely to your Google account.
          </p>
        </div>

      </div>
    </div>
  );
}

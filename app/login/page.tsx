"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Zap, Loader2, Sparkles, AlertTriangle, WrenchIcon } from "lucide-react";

const SKILLSARK_PORTAL =
  process.env.NEXT_PUBLIC_SKILLSARK_PORTAL_URL ?? "https://portal.skillsark.in";

interface PublicConfig {
  maintenance: { enabled: boolean; message: string };
  features:    { skillsarkSSO: boolean };
}

export default function LoginPage() {
  const [gLoading, setGLoading]     = useState(false);
  const [sLoading, setSLoading]     = useState(false);
  const [error,    setError]        = useState("");
  const [cfgLoading, setCfgLoading] = useState(true);
  const [config,   setConfig]       = useState<PublicConfig | null>(null);
  const { user }  = useAuth();
  const router    = useRouter();

  useEffect(() => { if (user) router.replace("/"); }, [user, router]);

  // ── Load maintenance / feature config ─────────────────────────
  useEffect(() => {
    fetch("/api/public-config")
      .then(r => r.json())
      .then(d => setConfig(d))
      .catch(() => {}) // silent — defaults
      .finally(() => setCfgLoading(false));
  }, []);

  const isMaintenance = config?.maintenance?.enabled === true;
  const showSkillsark = config?.features?.skillsarkSSO !== false; // show by default

  // ── Google sign-in ───────────────────────────
  const handleGoogle = async () => {
    if (isMaintenance) return;
    setError(""); setGLoading(true);
    if (!auth) { setError("Firebase is not configured. Check environment variables."); setGLoading(false); return; }
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // silent
      } else if (code === "auth/unauthorized-domain") {
        setError("Domain not authorized in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.");
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally { setGLoading(false); }
  };

  // ── Skillsark SSO ────────────────────────────
  const handleSkillsark = () => {
    if (isMaintenance) return;
    setError(""); setSLoading(true);
    const callbackUrl = `${window.location.origin}/auth/callback`;
    const redirectUrl = `${SKILLSARK_PORTAL}/auth-gate.php?return_to=${encodeURIComponent(callbackUrl)}`;
    window.location.href = redirectUrl;
  };

  const isLoading = gLoading || sLoading || cfgLoading;

  // ── Maintenance screen ────────────────────────
  if (!cfgLoading && isMaintenance) {
    return (
      <div style={{
        minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:"var(--bg)", padding:"24px 16px",
        backgroundImage:"radial-gradient(ellipse at 40% 50%, rgba(239,68,68,.08) 0%,transparent 55%)",
      }}>
        <div style={{ width:"100%", maxWidth:400, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
          <div style={{ width:60, height:60, borderRadius:18, background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <WrenchIcon size={26} color="#f87171"/>
          </div>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, color:"var(--tx-1)", marginBottom:10 }}>Under Maintenance</h1>
            <p style={{ fontSize:14, color:"var(--tx-2)", lineHeight:1.7 }}>
              {config?.maintenance?.message || "We're making improvements. Please check back later."}
            </p>
          </div>
          <div style={{ fontSize:12, color:"var(--tx-3)", padding:"8px 16px", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:10 }}>
            🔧 App is temporarily offline
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg)", padding:"24px 16px",
      backgroundImage:`
        radial-gradient(ellipse at 20% 50%, rgba(123,104,238,.12) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 10%, rgba(59,130,246,.08) 0%, transparent 50%),
        radial-gradient(ellipse at 60% 90%, rgba(168,85,247,.06) 0%, transparent 45%)
      `,
    }}>
      <div style={{ width:"100%", maxWidth:390, display:"flex", flexDirection:"column", alignItems:"center", gap:28 }}>

        {/* Logo */}
        <div style={{ textAlign:"center" }}>
          <div style={{
            width:56, height:56, borderRadius:16, margin:"0 auto 18px",
            background:"linear-gradient(135deg, rgba(123,104,238,.25), rgba(123,104,238,.05))",
            border:"1px solid var(--accent-brd)", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 32px rgba(123,104,238,.2)",
          }}>
            <Zap size={24} color="var(--accent-fg)"/>
          </div>
          <h1 style={{ fontSize:26, fontWeight:700, color:"var(--tx-1)", letterSpacing:"-.025em", lineHeight:1.2, marginBottom:8 }}>
            Prompt Master AI
          </h1>
          <p style={{ fontSize:14, color:"var(--tx-2)", lineHeight:1.6 }}>
            Engineer perfect prompts for any AI model
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
          {["🎭 Role-play","🌐 Context-rich","📋 Structured","🖼️ Vision","⚡ Instant copy"].map(f=>(
            <span key={f} style={{ fontSize:11.5, color:"var(--tx-3)", background:"var(--bg-card)", border:"1px solid var(--border)", padding:"3px 10px", borderRadius:"var(--rf)" }}>{f}</span>
          ))}
        </div>

        {/* Auth card */}
        <div style={{
          width:"100%", background:"rgba(23,23,29,0.88)", backdropFilter:"blur(24px)",
          border:"1px solid var(--border-lg)", borderRadius:"var(--r5)", padding:"28px 24px",
          boxShadow:"0 24px 64px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03)",
        }}>
          <div style={{ textAlign:"center", marginBottom:22 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"center", marginBottom:6 }}>
              <Sparkles size={13} color="var(--accent-fg)"/>
              <span style={{ fontSize:11.5, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"var(--accent-fg)" }}>
                Free to use
              </span>
            </div>
            <p style={{ fontSize:14, color:"var(--tx-2)" }}>
              Sign in to start engineering prompts
            </p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

            {/* Google button */}
            <button onClick={handleGoogle} disabled={isLoading} style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12,
              padding:"12px 20px", borderRadius:"var(--r2)",
              background:gLoading?"var(--bg-card)":"rgba(255,255,255,0.06)",
              border:"1px solid var(--border-lg)", color:"var(--tx-1)", fontSize:14, fontWeight:600,
              cursor:isLoading?"not-allowed":"pointer", opacity:sLoading?.45:1, transition:"all .18s",
            }}
              onMouseEnter={e=>{if(!isLoading){e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.transform="translateY(-1px)";}}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.transform="none";}}>
              {gLoading?<Loader2 size={17} className="spin"/>:(
                <svg width="17" height="17" viewBox="0 0 24 24" style={{flexShrink:0}}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {gLoading?"Opening Google…":"Continue with Google"}
            </button>

            {/* Divider */}
            {showSkillsark && (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1, height:1, background:"var(--border)" }}/>
                <span style={{ fontSize:11, color:"var(--tx-3)", fontWeight:600, letterSpacing:".05em" }}>OR</span>
                <div style={{ flex:1, height:1, background:"var(--border)" }}/>
              </div>
            )}

            {/* Skillsark button */}
            {showSkillsark && (
              <button onClick={handleSkillsark} disabled={isLoading} style={{
                width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12,
                padding:"12px 20px", borderRadius:"var(--r2)",
                background:sLoading?"rgba(99,102,241,.15)":"linear-gradient(135deg, rgba(99,102,241,.18), rgba(139,92,246,.12))",
                border:"1px solid rgba(99,102,241,.35)", color:"#c7d2fe", fontSize:14, fontWeight:600,
                cursor:isLoading?"not-allowed":"pointer", opacity:gLoading?.45:1, transition:"all .18s",
              }}
                onMouseEnter={e=>{if(!isLoading){e.currentTarget.style.background="linear-gradient(135deg, rgba(99,102,241,.28), rgba(139,92,246,.2))";e.currentTarget.style.transform="translateY(-1px)";}}}
                onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg, rgba(99,102,241,.18), rgba(139,92,246,.12))";e.currentTarget.style.transform="none";}}>
                {sLoading?<Loader2 size={17} className="spin"/>:(
                  <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff" }}>S</div>
                )}
                {sLoading?"Redirecting to Skillsark…":"Continue with Skillsark"}
              </button>
            )}
          </div>

          {/* Error */}
          {error&&(
            <div style={{ marginTop:14, padding:"10px 14px", borderRadius:"var(--r2)", background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", fontSize:12.5, color:"#f87171", display:"flex", alignItems:"flex-start", gap:8 }}>
              <AlertTriangle size={13} style={{flexShrink:0,marginTop:1}}/>{error}
            </div>
          )}

          <p style={{ fontSize:11.5, color:"var(--tx-3)", textAlign:"center", marginTop:18, lineHeight:1.6 }}>
            By continuing, you agree to our Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}

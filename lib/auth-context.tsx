"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "./firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  blockedReason: string | null;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, signOut: async () => {}, blockedReason: null,
});

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "admin-secret-2025";

// Register user via server API — returns blocked status if banned/suspended
async function syncUser(u: User): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({
        action: "registerUser",
        user: {
          uid:      u.uid,
          email:    u.email    ?? "",
          name:     u.displayName ?? u.email?.split("@")[0] ?? "User",
          photoURL: u.photoURL ?? "",
          provider: u.providerData?.[0]?.providerId ?? "google",
        },
      }),
    });
    const data = await res.json();
    if (data.blocked) return { blocked: true, reason: data.reason ?? "Account blocked." };
    return { blocked: false };
  } catch (e) {
    console.warn("[Auth] syncUser error:", e);
    return { blocked: false }; // Don't block login on API error
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [blockedReason, setBlocked]   = useState<string | null>(null);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        if (u) {
          // Check if banned/suspended before allowing in
          const { blocked, reason } = await syncUser(u);
          if (blocked) {
            // Sign them out immediately
            await firebaseSignOut(auth!);
            setBlocked(reason ?? "Your account has been blocked.");
            setUser(null);
            setLoading(false);
            return;
          }
          setBlocked(null);
          setUser(u);
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (err) => { console.error("Auth error:", err); setLoading(false); }
    );
    return unsub;
  }, []);

  const signOut = async () => {
    if (auth) await firebaseSignOut(auth);
    setBlocked(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, blockedReason }}>
      {/* Show blocked message at top level if signed out due to ban */}
      {blockedReason && !user && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)",
        }}>
          <div style={{
            maxWidth: 380, width: "90%", background: "#111116",
            border: "1px solid rgba(239,68,68,.3)", borderRadius: 16, padding: "28px 24px",
            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          }}>
            <div style={{ fontSize: 36 }}>🚫</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f87171" }}>Account Blocked</div>
            <div style={{ fontSize: 13.5, color: "#a1a1aa", lineHeight: 1.7 }}>{blockedReason}</div>
            <button
              onClick={() => { setBlocked(null); window.location.href = "/login"; }}
              style={{ padding: "9px 22px", borderRadius: 10, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.35)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Go to Login
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

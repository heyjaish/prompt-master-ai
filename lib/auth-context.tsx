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

interface ContactInfo {
  email: string;
  message: string;
  supportUrl: string;
}

// Register/sync user, returns block status
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
    if (data.blocked) return { blocked: true, reason: data.reason ?? "banned" };
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

// Fetch contact info for the block screen
async function fetchContact(): Promise<ContactInfo> {
  try {
    const res  = await fetch("/api/public-config");
    const data = await res.json();
    return data.contact ?? { email: "jaishkumar55@gmail.com", message: "Please contact admin for help.", supportUrl: "" };
  } catch {
    return { email: "jaishkumar55@gmail.com", message: "Please contact admin for help.", supportUrl: "" };
  }
}

// ── Block screen ───────────────────────────────────────────────
function BlockScreen({ reason, contact, onClose }: { reason: string; contact: ContactInfo; onClose: () => void }) {
  const isBanned    = reason === "banned";
  const isSuspended = reason === "suspended";
  const emoji  = isBanned ? "🚫" : "⏸️";
  const title  = isBanned ? "Account Banned" : "Account Suspended";
  const desc   = isBanned
    ? "Your account has been permanently banned from Prompt Master AI."
    : "Your account has been temporarily suspended. Please contact support.";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,.88)", backdropFilter: "blur(10px)",
    }}>
      <div style={{
        maxWidth: 400, width: "90%", background: "#111116",
        border: "1px solid rgba(239,68,68,.3)", borderRadius: 18,
        padding: "32px 28px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,.7)",
      }}>
        <div style={{ fontSize: 42 }}>{emoji}</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#f87171", marginBottom: 8, letterSpacing: "-.02em" }}>{title}</div>
          <div style={{ fontSize: 13.5, color: "#a1a1aa", lineHeight: 1.7 }}>{desc}</div>
        </div>

        {/* Contact message from admin */}
        {contact.message && (
          <div style={{
            fontSize: 12.5, color: "#e4e4e7", padding: "10px 14px",
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10, lineHeight: 1.6, width: "100%",
          }}>
            {contact.message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {/* Email admin button */}
          {contact.email && (
            <a
              href={`mailto:${contact.email}?subject=Account ${title} - Prompt Master AI&body=Hello,%0A%0AMy account (blocked as: ${reason}) needs review.%0A%0APlease help.`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 20px", borderRadius: 11,
                background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.4)",
                color: "#a5b4fc", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
                transition: "background .15s",
              }}>
              ✉️ Email Admin — {contact.email}
            </a>
          )}

          {/* Support URL if set */}
          {contact.supportUrl && (
            <a href={contact.supportUrl} target="_blank" rel="noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 20px", borderRadius: 11,
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
              color: "#d4d4d8", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
            }}>
              🔗 Visit Support Page
            </a>
          )}

          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 11,
            background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
            color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            ← Back to Login
          </button>
        </div>

        <div style={{ fontSize: 11, color: "#52525b" }}>
          Prompt Master AI · Account Management
        </div>
      </div>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]             = useState<User | null>(null);
  const [loading, setLoading]       = useState(true);
  const [blockedReason, setBlocked] = useState<string | null>(null);
  const [contact, setContact]       = useState<ContactInfo>({ email: "jaishkumar55@gmail.com", message: "", supportUrl: "" });

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        if (u) {
          const { blocked, reason } = await syncUser(u);
          if (blocked) {
            await firebaseSignOut(auth!);
            // Fetch contact info to show in block screen
            const c = await fetchContact();
            setContact(c);
            setBlocked(reason ?? "banned");
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

  const handleCloseBlock = () => {
    setBlocked(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, blockedReason }}>
      {blockedReason && !user && (
        <BlockScreen reason={blockedReason} contact={contact} onClose={handleCloseBlock} />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

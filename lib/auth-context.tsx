"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "./firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, signOut: async () => {},
});

// Register user via server API (bypasses Firestore rules)
async function syncUserToFirestore(u: User) {
  try {
    const token = await u.getIdToken();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "",
      },
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
    if (!res.ok) console.warn("[Auth] syncUser failed:", data.error);
    return data;
  } catch (e) {
    console.warn("[Auth] syncUser error:", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase auth not initialized.");
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        setUser(u);
        setLoading(false);
        if (u) {
          // Sync to Firestore via server (no rules needed)
          syncUserToFirestore(u);
        }
      },
      (err) => { console.error("Auth error:", err); setLoading(false); }
    );
    return unsub;
  }, []);

  const signOut = async () => { if (auth) await firebaseSignOut(auth); };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

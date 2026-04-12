"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "./firebase";
import { registerUser } from "./admin";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase auth not initialized — check env vars.");
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        setUser(u);
        setLoading(false);

        // ── Write/update user profile in Firestore on every login ──
        if (u) {
          try {
            await registerUser({
              uid:      u.uid,
              email:    u.email    ?? "",
              name:     u.displayName ?? u.email?.split("@")[0] ?? "User",
              photoURL: u.photoURL ?? "",
              provider: u.providerData?.[0]?.providerId ?? "google",
            });
          } catch (err) {
            console.warn("registerUser failed:", err);
          }
        }
      },
      (err) => {
        console.error("Auth state error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  const signOut = async () => {
    if (auth) await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

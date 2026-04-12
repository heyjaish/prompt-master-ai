"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Zap } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--bg)", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>
          <Zap size={20} color="var(--accent-fg)" />
        </div>
        <div style={{ fontSize: 13, color: "var(--tx-3)" }}>Loading…</div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

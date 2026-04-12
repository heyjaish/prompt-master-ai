"use client";
import { useState, useRef, useEffect } from "react";
import { Zap, LogOut, ChevronDown, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SpecialistBar, { Specialist } from "@/components/SpecialistBar";

interface Props {
  activeSpecialist: Specialist | null;
  onActivate: (s: Specialist | null) => void;
}

export default function Header({ activeSpecialist, onActivate }: Props) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.displayName
    ? user.displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <header className="header" style={{ justifyContent: "space-between", gap: 12 }}>

      {/* Left: Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={13} color="var(--accent-fg)" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-.01em" }}>
          Prompt Master
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase",
          color: "var(--accent-fg)", background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
          padding: "2px 6px", borderRadius: "var(--rf)",
        }}>AI</span>
      </div>

      {/* Center: Specialist Bar */}
      {user && (
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SpecialistBar
            uid={user.uid}
            activeSlot={activeSpecialist?.slotId ?? null}
            onActivate={onActivate}
          />
        </div>
      )}

      {/* Right: User menu */}
      {user && (
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 10px 5px 6px", borderRadius: "var(--r2)",
              background: open ? "var(--bg-hover)" : "transparent",
              border: "1px solid", borderColor: open ? "var(--border-md)" : "transparent",
              cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border-md)"; }}
            onMouseLeave={e => { if (!open) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
          >
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="Avatar" style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid var(--border-md)" }} />
            ) : (
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "var(--accent-fg)",
              }}>{initials}</div>
            )}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tx-1)", lineHeight: 1.3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.displayName || user.email?.split("@")[0]}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--tx-3)", lineHeight: 1.3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            </div>
            <ChevronDown size={12} style={{ color: "var(--tx-3)", transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0)" }} />
          </button>

          {/* Dropdown */}
          {open && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
              background: "rgba(23,23,29,0.95)", backdropFilter: "blur(16px)",
              border: "1px solid var(--border-lg)", borderRadius: "var(--r3)",
              padding: 6, minWidth: 180,
              boxShadow: "0 12px 40px rgba(0,0,0,.5)",
            }}>
              <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)" }}>
                  {user.displayName || "User"}
                </div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>{user.email}</div>
              </div>
              <button
                onClick={() => { signOut(); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: "var(--r1)",
                  background: "transparent", border: "none",
                  color: "#f87171", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "background .15s", marginTop: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}

      {!user && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <User size={14} style={{ color: "var(--tx-3)" }} />
        </div>
      )}
    </header>
  );
}

"use client";

export default function Header() {
  return (
    <header className="header">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-.015em" }}>
          Prompt Master
        </span>
        <span style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em",
          textTransform: "uppercase", color: "var(--accent-fg)",
          background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
          padding: "2px 7px", borderRadius: "var(--rf)",
        }}>
          AI
        </span>
      </div>
    </header>
  );
}

"use client";
import { useState } from "react";
import { FileText, Eye, Maximize2, Minimize2 } from "lucide-react";
import CopyableBlock from "./CopyableBlock";

interface Props { engineeredPrompt: string; originalIdea: string; }

function Preview({ prompt, idea }: { prompt: string; idea: string }) {
  const role    = prompt.match(/##\s*🎭\s*ROLE\n([\s\S]*?)(?=\n##|$)/)?.[1]?.trim().slice(0, 80) || "Expert AI";
  const words   = prompt.split(/\s+/).filter(Boolean).length;
  const secs    = (prompt.match(/## /g) || []).length;
  const strength= secs >= 5 ? "High" : secs >= 3 ? "Medium" : "Low";
  const strColor= secs >= 5 ? "var(--green)" : secs >= 3 ? "#f59e0b" : "var(--tx-2)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Words", value: words, color: "var(--accent-fg)" },
          { label: "Sections", value: secs, color: "var(--tx-2)" },
          { label: "Strength", value: strength, color: strColor },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: "var(--tx-3)", marginTop: 2, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Role badge */}
      <div style={{
        padding: "10px 12px", borderRadius: "var(--r2)",
        background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
        fontSize: 12.5, color: "var(--accent-fg)",
      }}>
        <span style={{ opacity: .6 }}>Role: </span>{role}
      </div>

      {/* Original idea */}
      <div style={{
        padding: "10px 12px", borderRadius: "var(--r2)",
        background: "var(--bg-card)", border: "1px solid var(--border-md)",
        fontSize: 12.5, color: "var(--tx-2)", lineHeight: 1.6,
      }}>
        <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx-3)", marginBottom: 4 }}>Original Idea</span>
        {idea.slice(0, 200)}{idea.length > 200 ? "…" : ""}
      </div>

      {/* Ready status */}
      <div style={{
        padding: "8px 12px", borderRadius: "var(--r2)",
        background: "var(--green-dim)", border: "1px solid rgba(34,197,94,.2)",
        fontSize: 12.5, color: "var(--green)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>✓</span> Prompt ready to use with any AI model
      </div>
    </div>
  );
}

export default function SplitPreview({ engineeredPrompt, originalIdea }: Props) {
  const [panel, setPanel] = useState<"both"|"prompt"|"preview">("both");
  const [full, setFull] = useState(false);

  return (
    <div style={{
      background: "var(--bg-panel)",
      border: "1px solid var(--border-md)",
      borderRadius: "var(--r4)",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      ...(full ? { position: "fixed", inset: 12, zIndex: 50 } : {}),
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,.02)", flexShrink: 0,
      }}>
        <div className="view-tabs">
          {(["both","prompt","preview"] as const).map(p => (
            <button key={p} onClick={() => setPanel(p)} className={`view-tab${panel===p?" active":""}`}>
              {p === "both" ? <><FileText size={11}/><Eye size={11}/> Both</> : p === "prompt" ? <><FileText size={11}/> Prompt</> : <><Eye size={11}/> Preview</>}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setFull(f => !f)} title={full ? "Exit fullscreen" : "Fullscreen"}>
          {full ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
        </button>
      </div>

      {/* Panels */}
      <div style={{
        display: "grid",
        gridTemplateColumns: panel === "both" ? "1fr 1fr" : "1fr",
        gap: 0, flex: 1, overflow: "hidden",
      }}>
        {(panel === "both" || panel === "prompt") && (
          <div style={{ overflow: "auto", padding: 14, borderRight: panel==="both" ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx-3)", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <FileText size={11}/> Refined Prompt
            </div>
            <CopyableBlock content={engineeredPrompt} />
          </div>
        )}
        {(panel === "both" || panel === "preview") && (
          <div style={{ overflow: "auto", padding: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx-3)", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <Eye size={11}/> Preview
            </div>
            <Preview prompt={engineeredPrompt} idea={originalIdea} />
          </div>
        )}
      </div>
    </div>
  );
}

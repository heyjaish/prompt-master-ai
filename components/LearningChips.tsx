"use client";
import { useState, useEffect, useRef } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { displayKeyword } from "@/lib/keywords";

interface Keyword { word: string; count: number; }

interface Props {
  uid: string;
  onChipClick: (word: string) => void;
  refreshTrigger?: number;         // increment to trigger a refresh
}

export default function LearningChips({ uid, onChipClick, refreshTrigger }: Props) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = () => {
    if (!uid) return;
    setLoading(true);
    fetch(`/api/keywords?uid=${uid}`)
      .then(r => r.json())
      .then(({ keywords: kws }) => setKeywords(kws || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [uid, refreshTrigger]);

  if (keywords.length === 0 && !loading) return null; // Don't show on first use

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <Sparkles size={10} color="#6366f1"/>
        <span style={{ fontSize: 10.5, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Your Style</span>
      </div>
      <div
        ref={scrollRef}
        style={{
          display: "flex", gap: 5, overflowX: "auto", flexShrink: 1,
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}
      >
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} style={{ height: 24, width: 64+i*12, borderRadius: 20, background: "rgba(99,102,241,.08)", flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }}/>
          ))
        ) : (
          keywords.slice(0, 15).map(({ word, count }) => (
            <button
              key={word}
              onClick={() => onChipClick(word)}
              title={`Used ${count} time${count>1?"s":""} — Click to add to prompt`}
              style={{
                flexShrink: 0, padding: "3px 10px",
                borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: "1px solid rgba(99,102,241,.25)",
                background: "rgba(99,102,241,.08)",
                color: "#a5b4fc", cursor: "pointer",
                transition: "all .15s", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,.2)"; e.currentTarget.style.borderColor = "rgba(99,102,241,.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,.08)"; e.currentTarget.style.borderColor = "rgba(99,102,241,.25)"; }}
            >
              {displayKeyword(word)}
              {count > 3 && <span style={{ marginLeft: 4, fontSize: 10, opacity: .6 }}>×{count}</span>}
            </button>
          ))
        )}
      </div>
      <button
        onClick={load}
        title="Refresh chips"
        style={{ flexShrink: 0, background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer", padding: 2 }}
      >
        <RefreshCw size={10}/>
      </button>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
    </div>
  );
}

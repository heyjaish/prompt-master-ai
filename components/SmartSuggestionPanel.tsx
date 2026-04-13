"use client";
import { useState, useEffect, useCallback } from "react";
import { Sparkles, ChevronRight, ChevronLeft, Zap, Brain, Loader2 } from "lucide-react";
import type { Specialist } from "@/components/SpecialistBar";
import type { HistoryEntry } from "@/lib/history";

interface Props {
  activeSpecialist: Specialist | null;
  history: HistoryEntry[];
  userKeywords: string[];
  onInsert: (text: string) => void;
  uid?: string;
}

export default function SmartSuggestionPanel({ activeSpecialist, history, userKeywords, onInsert, uid }: Props) {
  const [open, setOpen] = useState(true);
  const [clicked, setClicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Record<string, string[]>>({});

  // ── Load Favorites ──────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pm_panel_favorites");
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  const detectDomain = (specialist: Specialist | null): string => {
    if (!specialist) return "general";
    const text = (specialist.name + " " + (specialist.description ?? "")).toLowerCase();
    if (/image|photo|art|visual|draw|design|midjourney|dall/i.test(text)) return "image";
    if (/video|film|reel|youtube|tiktok|script/i.test(text)) return "video";
    if (/code|tech|dev|program|react|python|api|build/i.test(text)) return "code";
    if (/business|market|sales|email|copy|brand|seo/i.test(text)) return "business";
    if (/creative|write|story|poem|blog|content/i.test(text)) return "creative";
    return "general";
  };

  // ── Fetch Intelligent Suggestions ───────────────────────────
  const fetchSuggestions = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          history: history.slice(0, 10).map(h => ({ category: h.category, originalIdea: h.originalIdea })),
          activeSpecialist,
          userKeywords: userKeywords.slice(0, 5)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setTips(data.tips || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, [uid, activeSpecialist, history.length, userKeywords.length]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const toggleFavorite = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const domain = detectDomain(activeSpecialist);
    const domainFavs = favorites[domain] || [];
    const newDomainFavs = domainFavs.includes(text)
      ? domainFavs.filter(k => k !== text)
      : [...domainFavs, text];
    
    const newFavorites = { ...favorites, [domain]: newDomainFavs };
    setFavorites(newFavorites);
    localStorage.setItem("pm_panel_favorites", JSON.stringify(newFavorites));
  };

  const domain = detectDomain(activeSpecialist);
  const domainLabel: Record<string, string> = {
    image: "🖼️ Image", video: "🎬 Video", code: "💻 Code",
    business: "💼 Business", creative: "✍️ Creative", general: "⚡ General",
  };

  const handleClick = (text: string) => {
    onInsert(text);
    setClicked(text);
    setTimeout(() => setClicked(null), 1200);
    // Future: Track click persistence here
  };

  const domainFavs = favorites[domain] || [];

  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "stretch",
      flexShrink: 0, height: "100%", position: "relative",
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
          width: 24, height: 48, borderRadius: "8px 0 0 8px",
          background: "rgba(99,102,241,.18)", border: "1px solid rgba(99,102,241,.32)",
          borderRight: "none", color: "#818cf8", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10, transition: "background .15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,.35)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,.18)")}
      >
        {open ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
      </button>

      {/* Panel */}
      <div style={{
        width: open ? 210 : 0,
        overflow: "hidden",
        transition: "width .25s cubic-bezier(.4,0,.2,1)",
        background: "rgba(9,9,13,.98)",
        borderLeft: "1px solid rgba(99,102,241,.18)",
        display: "flex", flexDirection: "column",
        flexShrink: 0,
      }}>
        <div style={{ width: 210, display: "flex", flexDirection: "column", height: "100%", padding: "14px 12px" }}>
          
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(99,102,241,.25)", border: "1px solid rgba(99,102,241,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Brain size={13} color="#818cf8"/>
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", letterSpacing: ".02em" }}>SUGGESTIONS</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.4)" }}>{domainLabel[domain]} Intelligence</div>
              </div>
            </div>
            {loading && <Loader2 size={12} className="animate-spin" color="#6366f1" />}
          </div>

          <div className="panel-scroll" style={{ overflowY: "auto", flex: 1, paddingRight: 4, display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* SECTION A: AI SUGGESTIONS */}
            {(suggestions.length > 0 || loading) && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={10} color="#6366f1"/> Smart Actions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5.5 }}>
                  {suggestions.map(text => (
                    <Chip key={text} text={text} active={clicked === text} onClick={() => handleClick(text)} accent="#6366f1"/>
                  ))}
                  {loading && suggestions.length === 0 && Array(6).fill(0).map((_,i) => <Skeleton key={i} />)}
                </div>
              </div>
            )}

            {/* SECTION B: SMART TIPS */}
            {(tips.length > 0 || loading) && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <Zap size={10} color="#8b5cf6"/> Deep Tips
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5.5 }}>
                  {tips.map(text => (
                    <Chip key={text} text={text} active={clicked === text} isFav={domainFavs.includes(text)} onToggleFav={(e) => toggleFavorite(text, e)} onClick={() => handleClick(text)} accent="#8b5cf6"/>
                  ))}
                  {loading && tips.length === 0 && Array(8).fill(0).map((_,i) => <Skeleton key={i} />)}
                </div>
              </div>
            )}
          </div>

          <style>{`
            .panel-scroll::-webkit-scrollbar { width: 4px; }
            .panel-scroll::-webkit-scrollbar-track { background: transparent; }
            .panel-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
            .panel-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            @keyframes pulse-op { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
            .animate-pulse-op { animation: pulse-op 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .animate-spin { animation: spin 1s linear infinite; }
          `}</style>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="animate-pulse-op" style={{ height: 28, background: "rgba(255,255,255,.05)", borderRadius: 8, width: "100%" }} />;
}

function Chip({ text, active, isFav, onToggleFav, onClick, accent }: { text: string; active: boolean; isFav?: boolean; onToggleFav?: (e: React.MouseEvent) => void; onClick: () => void; accent: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", flexShrink: 0 }}
    >
      <button
        onClick={onClick}
        style={{
          width: "100%", textAlign: "left", padding: "7px 24px 7px 10px",
          borderRadius: 8, border: `1px solid ${active ? accent + "66" : "rgba(255,255,255,.08)"}`,
          background: active ? `${accent}25` : hover ? `${accent}15` : "rgba(255,255,255,.04)",
          color: active ? "#fff" : hover ? "#f1f5f9" : "rgba(255,255,255,.6)",
          fontSize: 11.5, cursor: "pointer", transition: "all .12s",
          whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.35,
          minHeight: 30, display: "flex", alignItems: "center", fontWeight: 500
        }}
      >
        {text}
      </button>
      
      {onToggleFav && (isFav || hover || active) && (
        <button
          onClick={onToggleFav}
          style={{
            position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: isFav ? "#fbbf24" : "rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 2, borderRadius: 4, transition: "color 0.2s"
          }}
        >
          {isFav ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}

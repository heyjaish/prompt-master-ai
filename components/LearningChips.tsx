"use client";
import { useState, useEffect, useRef } from "react";
import { Sparkles, Star } from "lucide-react";
import { displayKeyword } from "@/lib/keywords";

interface Keyword { word: string; count: number; lastSeen?: number; }

interface Props {
  uid: string;
  specialistId?: string;           // scope chips to this specialist
  onChipClick: (word: string) => void;
  refreshTrigger?: number;
}

const FAV_KEY = (uid: string, sid?: string) =>
  `pm_fav_${uid}_${sid ?? "global"}`;

export default function LearningChips({ uid, specialistId, onChipClick, refreshTrigger }: Props) {
  const [keywords, setKeywords]   = useState<Keyword[]>([]);
  const [loading, setLoading]     = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load favorites from localStorage ──────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY(uid, specialistId));
      setFavorites(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setFavorites(new Set()); }
  }, [uid, specialistId]);

  // ── Fetch keywords (specialist-scoped) ────────────────────
  const load = () => {
    if (!uid) return;
    setLoading(true);
    const url = specialistId
      ? `/api/keywords?uid=${uid}&specialistId=${specialistId}`
      : `/api/keywords?uid=${uid}`;
    fetch(url)
      .then(r => r.json())
      .then(({ keywords: kws }) => setKeywords(kws || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [uid, specialistId, refreshTrigger]);

  // ── Toggle favorite ────────────────────────────────────────
  const toggleFav = (word: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(word) ? next.delete(word) : next.add(word);
      try { localStorage.setItem(FAV_KEY(uid, specialistId), JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // ── Sort: starred → most used → recent ───────────────────
  const sorted = [...keywords].sort((a, b) => {
    const aFav = favorites.has(a.word) ? 1 : 0;
    const bFav = favorites.has(b.word) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;   // favorites first
    if (b.count !== a.count) return b.count - a.count; // then by count
    return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);       // then by recency
  });

  if (sorted.length === 0 && !loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Sparkles size={10} color="#6366f1"/>
        <span style={{ fontSize: 10.5, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
          {specialistId ? "Module Keywords" : "Your Style"}
        </span>
        {specialistId && (
          <span style={{ fontSize: 10, color: "var(--tx-3)", background: "rgba(99,102,241,.12)", padding: "1px 6px", borderRadius: 10, border: "1px solid rgba(99,102,241,.2)" }}>
            scoped
          </span>
        )}
      </div>

      {/* Chips row */}
      <div
        ref={scrollRef}
        style={{ display: "flex", gap: 5, overflowX: "auto", flexWrap: "nowrap", scrollbarWidth: "none" }}
      >
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} style={{ height: 26, width: 64 + i*12, borderRadius: 20, background: "rgba(99,102,241,.08)", flexShrink: 0, animation: "chipPulse 1.5s ease-in-out infinite" }}/>
          ))
        ) : (
          sorted.slice(0, 18).map(({ word, count }) => {
            const isFav = favorites.has(word);
            return (
              <div key={word} style={{ display: "flex", alignItems: "center", flexShrink: 0, borderRadius: 20, overflow: "hidden", border: `1px solid ${isFav ? "rgba(251,191,36,.4)" : "rgba(99,102,241,.22)"}`, background: isFav ? "rgba(251,191,36,.08)" : "rgba(99,102,241,.07)", transition: "all .15s" }}>
                {/* Keyword button */}
                <button
                  onClick={() => onChipClick(word)}
                  title={`Used ${count}× — click to add`}
                  style={{
                    padding: "3px 8px 3px 10px", fontSize: 12, fontWeight: 500,
                    background: "none", border: "none",
                    color: isFav ? "#fde68a" : "#a5b4fc",
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {displayKeyword(word)}
                  {count > 3 && <span style={{ marginLeft: 4, fontSize: 10, opacity: .55 }}>×{count}</span>}
                </button>

                {/* Star toggle */}
                <button
                  onClick={e => { e.stopPropagation(); toggleFav(word); }}
                  title={isFav ? "Unstar" : "Star to pin on top"}
                  style={{
                    padding: "3px 7px 3px 2px", background: "none", border: "none",
                    cursor: "pointer", color: isFav ? "#fbbf24" : "rgba(255,255,255,.2)",
                    fontSize: 11, lineHeight: 1, transition: "color .15s",
                    display: "flex", alignItems: "center",
                  }}
                  onMouseEnter={e => { if (!isFav) e.currentTarget.style.color = "#fbbf24"; }}
                  onMouseLeave={e => { if (!isFav) e.currentTarget.style.color = "rgba(255,255,255,.2)"; }}
                >
                  <Star size={10} fill={isFav ? "#fbbf24" : "none"} strokeWidth={isFav ? 0 : 1.5}/>
                </button>
              </div>
            );
          })
        )}
      </div>
      <style>{`@keyframes chipPulse{0%,100%{opacity:.35}50%{opacity:.65}}`}</style>
    </div>
  );
}

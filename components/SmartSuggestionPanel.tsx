"use client";
import { useState, useEffect } from "react";
import { Sparkles, ChevronRight, ChevronLeft, Zap, Brain } from "lucide-react";
import type { Specialist } from "@/components/SpecialistBar";

interface Props {
  activeSpecialist: Specialist | null;
  userKeywords: string[];        // from learning chips
  onInsert: (text: string) => void;
}

// Curated suggestions per specialist domain keyword
const DOMAIN_SUGGESTIONS: Record<string, string[]> = {
  image: [
    "cinematic lighting", "8K ultra HD", "hyperrealistic", "sharp focus",
    "dramatic shadows", "portrait lens 85mm", "bokeh background", "Unreal Engine 5",
    "golden hour", "cyberpunk aesthetic", "photorealistic", "--v 6 --ar 16:9",
    "octane render", "Studio lighting", "RAW photo", "color grading",
  ],
  video: [
    "cinematic 4K", "smooth slow motion", "dynamic transitions", "color grading",
    "drone shot", "handheld footage", "time lapse", "VFX compositing",
    "professional edit", "viral hook", "trending format", "storytelling arc",
  ],
  code: [
    "TypeScript strict", "React 18 hooks", "clean architecture", "add error handling",
    "optimize performance", "add comments", "REST API", "responsive design",
    "dark mode support", "Tailwind CSS", "unit tests", "async/await",
    "SOLID principles", "Docker ready", "API endpoints",
  ],
  business: [
    "professional tone", "persuasive copy", "call to action", "target audience",
    "pain points", "value proposition", "ROI focused", "B2B strategy",
    "email marketing", "brand voice", "conversion optimized", "data-driven",
  ],
  creative: [
    "vivid storytelling", "emotional depth", "unique perspective", "descriptive language",
    "plot twist", "character development", "immersive world", "poetic rhythm",
    "dramatic tension", "creative hook", "metaphorical", "narrative arc",
  ],
  general: [
    "step by step", "with examples", "bullet points", "professional tone",
    "concise and clear", "creative approach", "detailed explanation",
    "practical advice", "expert perspective", "actionable tips",
  ],
};

function detectDomain(specialist: Specialist | null): string {
  if (!specialist) return "general";
  const text = (specialist.name + " " + (specialist.description ?? "")).toLowerCase();
  if (/image|photo|art|visual|draw|design|midjourney|dall/i.test(text)) return "image";
  if (/video|film|reel|youtube|tiktok|script/i.test(text)) return "video";
  if (/code|tech|dev|program|react|python|api|build/i.test(text)) return "code";
  if (/business|market|sales|email|copy|brand|seo/i.test(text)) return "business";
  if (/creative|write|story|poem|blog|content/i.test(text)) return "creative";
  return "general";
}

export default function SmartSuggestionPanel({ activeSpecialist, userKeywords, onInsert }: Props) {
  const [open, setOpen] = useState(true);
  const [clicked, setClicked] = useState<string | null>(null);

  const domain = detectDomain(activeSpecialist);
  const domainSuggestions = DOMAIN_SUGGESTIONS[domain] ?? DOMAIN_SUGGESTIONS.general;

  // Merge user keywords (top 4) with domain suggestions, deduplicate
  const userTop = userKeywords.slice(0, 4).filter(k => !domainSuggestions.some(d => d.toLowerCase() === k.toLowerCase()));
  const allSuggestions = [...userTop, ...domainSuggestions].slice(0, 16);

  const handleClick = (text: string) => {
    onInsert(text);
    setClicked(text);
    setTimeout(() => setClicked(null), 1200);
  };

  const domainLabel: Record<string, string> = {
    image: "🖼️ Image", video: "🎬 Video", code: "💻 Code",
    business: "💼 Business", creative: "✍️ Creative", general: "⚡ General",
  };

  return (
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "stretch",
      flexShrink: 0, height: "100%", position: "relative",
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "absolute", left: -13, top: "50%", transform: "translateY(-50%)",
          width: 22, height: 44, borderRadius: "8px 0 0 8px",
          background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)",
          borderRight: "none", color: "#818cf8", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10, transition: "background .15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,.3)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,.15)")}
        title={open ? "Hide suggestions" : "Show AI suggestions"}
      >
        {open ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
      </button>

      {/* Panel */}
      <div style={{
        width: open ? 200 : 0,
        overflow: "hidden",
        transition: "width .22s cubic-bezier(.4,0,.2,1)",
        background: "rgba(9,9,13,.97)",
        borderLeft: "1px solid rgba(99,102,241,.18)",
        display: "flex", flexDirection: "column",
        flexShrink: 0,
      }}>
        <div style={{ width: 200, display: "flex", flexDirection: "column", height: "100%", padding: "12px 10px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexShrink: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={11} color="#818cf8"/>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: ".04em" }}>AI SUGGESTIONS</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.3)" }}>{domainLabel[domain]}</div>
            </div>
          </div>

          {/* User keywords section (if any) */}
          {userTop.length > 0 && (
            <>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                <Sparkles size={8} color="#6366f1"/> Your Style
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                {userTop.map(kw => (
                  <Chip key={kw} text={kw} active={clicked === kw} onClick={() => handleClick(kw)} accent="#6366f1"/>
                ))}
              </div>
            </>
          )}

          {/* Domain suggestions */}
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <Zap size={8} color="#8b5cf6"/> {domainLabel[domain]} Tips
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", flex: 1, scrollbarWidth: "none" }}>
            {domainSuggestions.slice(0, 12).map(kw => (
              <Chip key={kw} text={kw} active={clicked === kw} onClick={() => handleClick(kw)} accent="#8b5cf6"/>
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 8, fontSize: 9.5, color: "rgba(255,255,255,.2)", textAlign: "center", flexShrink: 0 }}>
            Click to insert → prompt
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ text, active, onClick, accent }: { text: string; active: boolean; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "5px 9px",
        borderRadius: 8, border: `1px solid ${active ? accent + "66" : "rgba(255,255,255,.07)"}`,
        background: active ? `${accent}22` : "rgba(255,255,255,.03)",
        color: active ? "#c4b5fd" : "rgba(255,255,255,.55)",
        fontSize: 11.5, cursor: "pointer", transition: "all .12s",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.borderColor = `${accent}44`; }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,.03)"; e.currentTarget.style.color = "rgba(255,255,255,.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.07)"; } }}
      title={`Insert: "${text}"`}
    >
      {text}
    </button>
  );
}

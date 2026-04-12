"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Check, X, Loader2 } from "lucide-react";

export interface Specialist {
  slotId: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
}

const EMPTY: Specialist = { slotId: "", name: "", emoji: "⭐", description: "", systemPrompt: "" };
const EMOJI_OPTIONS = ["⭐","🎨","💻","📊","⚡","🔬","📝","🎭","🏗️","📱","🎯","🧠","🚀","💡","🎬","📐","🔧","🌐","💎","🎵"];

interface Props {
  uid: string;
  activeSlot: string | null;
  onActivate: (specialist: Specialist | null) => void;
}

export default function SpecialistBar({ uid, activeSlot, onActivate }: Props) {
  const [slots, setSlots]       = useState<(Specialist | null)[]>([null,null,null,null,null]);
  const [loading, setLoading]   = useState(false);
  const [editing, setEditing]   = useState<number | null>(null);
  const [draft, setDraft]       = useState<Specialist>(EMPTY);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    fetch(`/api/specialists?uid=${uid}`)
      .then(r => r.json())
      .then(({ specialists }: { specialists: Specialist[] }) => {
        const arr: (Specialist | null)[] = [null,null,null,null,null];
        specialists.forEach(s => {
          const i = parseInt(s.slotId) - 1;
          if (i >= 0 && i < 5) arr[i] = s;
        });
        setSlots(arr);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  const openEditor = (i: number) => {
    const existing = slots[i];
    setDraft(existing ?? { ...EMPTY, slotId: String(i + 1) });
    setEditing(i);
  };

  const closeEditor = () => { setEditing(null); setDraft(EMPTY); };

  const saveSlot = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/specialists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, slotId: String((editing ?? 0) + 1), ...draft }),
      });
      const newSlots = [...slots];
      const saved = { ...draft, slotId: String((editing ?? 0) + 1) };
      newSlots[editing ?? 0] = saved;
      setSlots(newSlots);
      if (activeSlot === saved.slotId) onActivate(saved);
      closeEditor();
    } catch { }
    finally { setSaving(false); }
  };

  const handleActivate = (s: Specialist | null, i: number) => {
    if (!s) { openEditor(i); return; }
    if (activeSlot === s.slotId) { onActivate(null); }
    else { onActivate(s); }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <span style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", flexShrink: 0 }}>Specialist:</span>
        {loading ? (
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ width: 88, height: 30, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", animation: "pulse 1.5s ease-in-out infinite" }}/>
            ))}
          </div>
        ) : (
          slots.map((s, i) => {
            const isActive = s && activeSlot === s.slotId;
            return (
              <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                <button
                  onClick={() => handleActivate(s, i)}
                  title={s ? `${s.name}${isActive ? " — Click to deactivate" : " — Click to activate"}` : "Create specialist"}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 8, height: 30,
                    border: isActive ? "1px solid rgba(99,102,241,.6)" : "1px solid rgba(255,255,255,.09)",
                    background: isActive ? "rgba(99,102,241,.18)" : s ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.02)",
                    color: isActive ? "#818cf8" : s ? "var(--tx-2)" : "var(--tx-3)",
                    fontSize: 12, fontWeight: isActive ? 600 : 400,
                    cursor: "pointer", transition: "all .15s",
                    boxShadow: isActive ? "0 0 0 1px rgba(99,102,241,.3), 0 0 12px rgba(99,102,241,.15)" : "none",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{s?.emoji ?? "+"}</span>
                  <span style={{ maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s?.name ?? `Slot ${i+1}`}
                  </span>
                  {isActive && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }}/>}
                </button>
                {s && (
                  <button
                    onClick={e => { e.stopPropagation(); openEditor(i); }}
                    title="Edit specialist"
                    style={{
                      position: "absolute", top: -5, right: -5,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "rgba(23,23,29,.95)", border: "1px solid rgba(255,255,255,.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", opacity: 0,
                    }}
                    className="specialist-edit-btn"
                  >
                    <Pencil size={8} color="var(--tx-3)"/>
                  </button>
                )}
              </div>
            );
          })
        )}
        <style>{`
          div:hover > .specialist-edit-btn { opacity: 1 !important; }
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
        `}</style>
      </div>

      {/* Editor modal */}
      {editing !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
        }} onClick={closeEditor}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 440,
            background: "rgba(18,18,24,.97)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 18, padding: "24px 22px",
            boxShadow: "0 24px 64px rgba(0,0,0,.7)",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tx-1)" }}>
                {slots[editing] ? "Edit Specialist" : `Create Specialist — Slot ${editing + 1}`}
              </div>
              <button onClick={closeEditor} style={{ background:"none", border:"none", color:"var(--tx-3)", cursor:"pointer" }}><X size={16}/></button>
            </div>

            {/* Emoji picker */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tx-3)", display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".06em" }}>Icon</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => setDraft(d => ({ ...d, emoji: e }))}
                    style={{ width: 34, height: 34, borderRadius: 8, fontSize: 17, border: `1px solid ${draft.emoji===e?"rgba(99,102,241,.6)":"rgba(255,255,255,.07)"}`, background: draft.emoji===e?"rgba(99,102,241,.15)":"rgba(255,255,255,.03)", cursor: "pointer", transition: "all .1s" }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tx-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>Name *</label>
              <input
                value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Electronics Buddy, Python Expert…"
                autoFocus
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "var(--tx-1)", fontSize: 14, padding: "9px 12px", outline: "none" }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tx-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>What it does</label>
              <textarea
                value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                rows={3} placeholder="e.g. Arduino circuits, PCB design, sensor calibration, electronics troubleshooting"
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "var(--tx-1)", fontSize: 13, padding: "9px 12px", outline: "none", resize: "vertical", lineHeight: 1.6 }}
              />
              <div style={{ fontSize: 11.5, color: "var(--tx-3)", marginTop: 5 }}>
                💡 Describe your domain — AI will automatically include relevant technical details in every prompt
              </div>
            </div>

            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={closeEditor} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "1px solid rgba(255,255,255,.09)", background: "transparent", color: "var(--tx-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveSlot} disabled={saving || !draft.name.trim()} style={{ flex: 2, padding: "9px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving||!draft.name.trim()?.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {saving ? <><Loader2 size={13} className="spin"/>Saving…</> : <><Check size={13}/>Save Specialist</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

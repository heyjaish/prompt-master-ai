"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { Layers, MessageSquare, Zap, ThumbsUp, ThumbsDown } from "lucide-react";

import AuthGuard           from "@/components/AuthGuard";
import Sidebar             from "@/components/Sidebar";
import Header              from "@/components/Header";
import ChatInput, { UploadedImage } from "@/components/ChatInput";
import MessageBubble, { Message }   from "@/components/MessageBubble";
import TemplateButtons     from "@/components/TemplateButtons";
import SplitPreview        from "@/components/SplitPreview";
import type { Specialist } from "@/components/SpecialistBar";
import LearningChips       from "@/components/LearningChips";
import { HistoryEntry, detectCategory } from "@/lib/history";
import { savePrompt, loadPrompts, deletePrompt } from "@/lib/firestore-history";
import { useAuth }         from "@/lib/auth-context";
import { trackEvent }      from "@/lib/analytics";
import { extractKeywords } from "@/lib/keywords";

type ViewMode = "chat" | "split";

// Quick Action chips — static style modifiers
const QUICK_ACTIONS = [
  { label: "16:9 Ratio",     value: "aspect ratio 16:9" },
  { label: "9:16 Vertical",  value: "aspect ratio 9:16, vertical format" },
  { label: "4K Quality",     value: "4K ultra HD quality" },
  { label: "Hyperrealistic", value: "hyperrealistic, photorealistic" },
  { label: "Cinematic",      value: "cinematic lighting, dramatic shadows" },
  { label: "Midjourney",     value: "--v 6 --ar 16:9 --style raw" },
  { label: "Dark Mode UI",   value: "dark mode UI/UX design" },
  { label: "Step by Step",   value: "explain step by step with examples" },
  { label: "JSON Output",    value: "output as valid JSON" },
  { label: "Bullet Points",  value: "format response as concise bullet points" },
  { label: "Professional",   value: "formal professional tone" },
  { label: "Creative",       value: "creative and imaginative style" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [messages, setMessages]           = useState<Message[]>([]);
  const [history, setHistory]             = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [templateIdea, setTemplateIdea]   = useState("");
  const [appendText, setAppendText]       = useState("");
  const [selectedId, setSelectedId]       = useState<string | undefined>();
  const [viewMode, setViewMode]           = useState<ViewMode>("chat");
  const [latestPrompt, setLatestPrompt]   = useState<{ engineeredPrompt: string; originalIdea: string } | null>(null);
  const [activeSpecialist, setSpecialist] = useState<Specialist | null>(null);
  const [chipsRefresh, setChipsRefresh]   = useState(0);
  const [announcement, setAnnouncement]   = useState<{ enabled:boolean; title:string; message:string; type:string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load history + announcement on mount ─────────────────
  useEffect(() => {
    if (user) {
      loadPrompts(user.uid).then(setHistory).catch(() => {});
      trackEvent({ uid: user.uid, event: "session_start" });
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/public-config").then(r => r.json()).then(d => {
      if (d.announcement?.enabled) setAnnouncement(d.announcement);
    }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Main send handler ─────────────────────────────────────
  const handleSend = useCallback(async (idea: string, images: UploadedImage[]) => {
    if (!idea.trim() && images.length === 0) return;
    const uid = uuidv4(), aid = uuidv4();

    setMessages(prev => [
      ...prev,
      { id: uid, role: "user",  content: idea, images, timestamp: Date.now() },
      { id: aid, role: "ai",   content: "", isLoading: true, timestamp: Date.now() },
    ]);
    setIsLoading(true);

    // Track event
    if (user) {
      trackEvent({ uid: user.uid, event: "prompt_generated", metadata: { specialist: activeSpecialist?.name ?? "none", hasImages: images.length > 0 } });
      if (images.length > 0) trackEvent({ uid: user.uid, event: "image_uploaded" });
    }

    // Build contextual memory: last 3 prompts in same specialist
    const contextHistory = activeSpecialist
      ? history.filter(h => h.specialist === activeSpecialist.slotId).slice(0, 3).map(h => ({ originalIdea: h.originalIdea, engineeredPrompt: h.engineeredPrompt }))
      : history.slice(0, 2).map(h => ({ originalIdea: h.originalIdea, engineeredPrompt: h.engineeredPrompt }));

    try {
      const res = await fetch("/api/engineer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          images: images.map(i => ({ data: i.data, mimeType: i.mimeType })),
          uid: user?.uid,
          specialistName:   activeSpecialist?.name,
          specialistPrompt: activeSpecialist?.systemPrompt,
          contextHistory,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      const { engineeredPrompt, explanation } = await res.json();

      setMessages(prev => prev.map(m =>
        m.id === aid ? { ...m, engineeredPrompt, explanation, content: "", isLoading: false, timestamp: Date.now() } : m
      ));
      setLatestPrompt({ engineeredPrompt, originalIdea: idea });
      // Auto-switch to split view
      setViewMode("split");

      // Save to history
      const entry: HistoryEntry = {
        id: uuidv4(), title: idea.slice(0, 55) + (idea.length > 55 ? "…" : ""),
        engineeredPrompt, originalIdea: idea, timestamp: Date.now(),
        category: detectCategory(idea),
        specialist: activeSpecialist?.slotId,
      };
      if (user) {
        await savePrompt(user.uid, entry);
        setHistory(prev => [entry, ...prev.filter(e => e.id !== entry.id)]);

        // Extract & save keywords in background
        const keywords = extractKeywords(engineeredPrompt + " " + idea);
        if (keywords.length > 0) {
          fetch("/api/keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: user.uid, keywords }),
          }).catch(() => {});
          setChipsRefresh(n => n + 1);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      if (user) trackEvent({ uid: user.uid, event: "error_occurred", metadata: { msg: msg.slice(0,50) } });
      setMessages(prev => prev.filter(m => m.id !== aid));
    } finally { setIsLoading(false); }
  }, [user, history, activeSpecialist]);

  const handleTemplateSelect = useCallback((idea: string, type: string) => {
    if (user) trackEvent({ uid: user.uid, event: "template_clicked", metadata: { type } });
    setTemplateIdea(idea);
    setTimeout(() => handleSend(idea, []), 120);
  }, [handleSend, user]);

  const handleSelectHistory = (entry: HistoryEntry) => {
    setSelectedId(entry.id);
    setLatestPrompt({ engineeredPrompt: entry.engineeredPrompt, originalIdea: entry.originalIdea });
    setViewMode("split");
    if (user) trackEvent({ uid: user.uid, event: "history_opened" });
    setMessages([
      { id: uuidv4(), role: "user", content: entry.originalIdea, timestamp: entry.timestamp },
      { id: uuidv4(), role: "ai",  content: "", engineeredPrompt: entry.engineeredPrompt, timestamp: entry.timestamp },
    ]);
  };

  const handleNewChat = () => {
    setMessages([]); setSelectedId(undefined); setLatestPrompt(null); setViewMode("chat");
  };

  const handleChipClick = (word: string) => {
    setAppendText(word);
    if (user) trackEvent({ uid: user.uid, event: "chip_clicked", metadata: { word } });
  };

  const handleSpecialistActivate = (s: Specialist | null) => {
    setSpecialist(s);
    if (s && user) trackEvent({ uid: user.uid, event: "specialist_activated", metadata: { name: s.name } });
  };

  const handleSplitView = () => {
    setViewMode("split");
    if (user) trackEvent({ uid: user.uid, event: "split_view_opened" });
  };

  const isEmpty = messages.length === 0;
  const annColor = announcement?.type === "error" ? "#f87171" : announcement?.type === "warning" ? "#fbbf24" : announcement?.type === "success" ? "#4ade80" : "#818cf8";
  const annBg    = announcement?.type === "error" ? "rgba(239,68,68,.1)" : announcement?.type === "warning" ? "rgba(245,158,11,.1)" : announcement?.type === "success" ? "rgba(34,197,94,.1)" : "rgba(99,102,241,.1)";

  return (
    <AuthGuard>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <Sidebar
        history={history} selectedId={selectedId}
        onSelectHistory={handleSelectHistory}
        onNewChat={handleNewChat}
        onDeleteHistory={id => {
          if (user) deletePrompt(user.uid, id).catch(() => {});
          setHistory(p => p.filter(e => e.id !== id));
          if (selectedId === id) handleNewChat();
        }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Header activeSpecialist={activeSpecialist} onActivate={handleSpecialistActivate} />

        {/* Announcement banner */}
        {announcement?.enabled && (
          <div style={{ padding: "8px 20px", background: annBg, borderBottom: `1px solid ${annColor}33`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: annColor, marginRight: 8 }}>{announcement.title}</span>
              <span style={{ fontSize: 12.5, color: "var(--tx-2)" }}>{announcement.message}</span>
            </div>
            <button onClick={() => setAnnouncement(null)} style={{ background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* View toggle */}
        {latestPrompt && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 20px", borderBottom: "1px solid var(--border)", background: "rgba(17,17,22,0.7)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
            <div className="view-tabs">
              {(["chat", "split"] as ViewMode[]).map(m => (
                <button key={m} onClick={() => { setViewMode(m); if(m==="split") handleSplitView(); }} className={`view-tab${viewMode === m ? " active" : ""}`}>
                  {m === "chat" ? <MessageSquare size={11}/> : <Layers size={11}/>}
                  {m === "chat" ? "Chat" : "Split View"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {viewMode === "split" && latestPrompt ? (
            <div className="flex-1 scroll" style={{ padding: 20 }}>
              <SplitPreview engineeredPrompt={latestPrompt.engineeredPrompt} originalIdea={latestPrompt.originalIdea} />
            </div>
          ) : (
            <div className="flex-1 scroll">
              {isEmpty ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 24px", gap: 24 }}>
                  <div className="empty-icon"><Zap size={22} color="var(--accent-fg)"/></div>
                  <div style={{ textAlign: "center", maxWidth: 500 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--tx-1)", letterSpacing: "-.025em", lineHeight: 1.25, marginBottom: 10 }}>
                      Engineer your perfect prompt
                    </h1>
                    <p style={{ fontSize: 14.5, color: "var(--tx-2)", lineHeight: 1.7 }}>
                      {activeSpecialist
                        ? `${activeSpecialist.emoji} ${activeSpecialist.name} mode active — describe your idea for domain-optimized results`
                        : "Describe any raw idea and get a single, ready-to-paste AI prompt — crafted for ChatGPT, Claude, Midjourney, DALL·E, and more."}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 480 }}>
                    {["🎭 Persona-driven","🌐 Context-rich","📋 Task-specific","🖼️ Vision aware","⚡ Copy-ready","🔀 Split preview"].map(f => (
                      <span key={f} style={{ fontSize: 12, color: "var(--tx-3)", background: "var(--bg-card)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: "var(--rf)" }}>{f}</span>
                    ))}
                  </div>
                  <TemplateButtons onSelect={handleTemplateSelect} disabled={isLoading}/>
                </div>
              ) : (
                <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 28 }}>
                  {messages.map(msg => <MessageBubble key={msg.id} message={msg}/>)}
                  {/* Prompt rating for last AI message */}
                  {!isLoading && messages.length > 0 && messages[messages.length-1].role === "ai" && latestPrompt && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--tx-3)" }}>Was this prompt helpful?</span>
                      <button
                        onClick={() => { if(user) trackEvent({ uid: user.uid, event: "prompt_rated_up" }); toast.success("Thanks for the feedback! 🎉"); }}
                        style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(34,197,94,.3)", background: "rgba(34,197,94,.08)", color: "#4ade80", fontSize: 12, cursor: "pointer", display:"flex", alignItems:"center", gap:5 }}>
                        <ThumbsUp size={12}/> Yes
                      </button>
                      <button
                        onClick={() => { if(user) trackEvent({ uid: user.uid, event: "prompt_rated_down" }); toast("We'll improve! 💪", { icon: "💡" }); }}
                        style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "#f87171", fontSize: 12, cursor: "pointer", display:"flex", alignItems:"center", gap:5 }}>
                        <ThumbsDown size={12}/> Could be better
                      </button>
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </div>
              )}
            </div>
          )}

          {/* ── Input area ─────────────────── */}
          <div style={{ flexShrink: 0, background: "rgba(11,11,14,0.9)", backdropFilter: "blur(16px)", borderTop: "1px solid var(--border)", padding: "10px 20px 16px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Learning chips — user's personalized keywords */}
              {user && (
                <LearningChips uid={user.uid} onChipClick={handleChipClick} refreshTrigger={chipsRefresh}/>
              )}

              {/* Templates row */}
              {!isEmpty && <TemplateButtons onSelect={handleTemplateSelect} disabled={isLoading}/>}

              {/* Quick Action chips */}
              <div className="quick-bar">
                {QUICK_ACTIONS.map(a => (
                  <button key={a.label} onClick={() => { setAppendText(a.value); if(user) trackEvent({uid:user.uid, event:"chip_clicked", metadata:{word:a.label}}); }} disabled={isLoading} className="quick-chip" title={`Append: "${a.value}"`}>
                    {a.label}
                  </button>
                ))}
              </div>

              <ChatInput
                onSend={handleSend}
                isLoading={isLoading}
                initialValue={templateIdea}
                onClearInitial={() => setTemplateIdea("")}
                appendText={appendText}
                onClearAppend={() => setAppendText("")}
              />

              {/* Active specialist indicator */}
              {activeSpecialist && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#818cf8" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: "pulse 2s ease-in-out infinite", display: "inline-block" }}/>
                  <span>{activeSpecialist.emoji} {activeSpecialist.name} specialist active</span>
                  <button onClick={() => setSpecialist(null)} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 11, marginLeft: 2 }}>✕</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}

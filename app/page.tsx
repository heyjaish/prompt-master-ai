"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { Layers, MessageSquare, Zap } from "lucide-react";

import AuthGuard               from "@/components/AuthGuard";
import Sidebar                 from "@/components/Sidebar";
import Header                  from "@/components/Header";
import ChatInput, { UploadedImage } from "@/components/ChatInput";
import MessageBubble, { Message }   from "@/components/MessageBubble";
import SplitPreview            from "@/components/SplitPreview";
import SmartSuggestionPanel    from "@/components/SmartSuggestionPanel";
import type { Specialist }     from "@/components/SpecialistBar";
import LearningChips           from "@/components/LearningChips";
import { HistoryEntry, detectCategory } from "@/lib/history";
import { savePrompt, loadPrompts, deletePrompt } from "@/lib/firestore-history";
import { useAuth }             from "@/lib/auth-context";
import { trackEvent }          from "@/lib/analytics";
import { extractKeywords }     from "@/lib/keywords";

type ViewMode = "chat" | "split";
const VIEW_PREF_KEY = "pm_view_pref";

export default function HomePage() {
  const { user } = useAuth();
  const [messages, setMessages]             = useState<Message[]>([]);
  const [history, setHistory]               = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded]   = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [appendText, setAppendText]         = useState("");
  const [selectedId, setSelectedId]         = useState<string | undefined>();
  const [viewMode, setViewMode]             = useState<ViewMode>("chat");
  const [userSetView, setUserSetView]       = useState(false);
  const [latestPrompt, setLatestPrompt]     = useState<{ engineeredPrompt: string; originalIdea: string } | null>(null);
  const [activeSpecialist, setSpecialist]   = useState<Specialist | null>(null);
  const [chipsRefresh, setChipsRefresh]     = useState(0);
  const [learnedKeywords, setLearnedKws]    = useState<string[]>([]);
  const [announcement, setAnnouncement]     = useState<{ enabled:boolean; title:string; message:string; type:string } | null>(null);
  const [features, setFeatures]             = useState<{ splitView:boolean; history:boolean; imageUpload:boolean }>({ splitView:true, history:true, imageUpload:true });
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [chipsCollapsed, setChipsCollapsed] = useState(false); // bottom keyword panel
  const inputIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-hide entire input panel after 15s idle
  const resetInputTimer = () => {
    if (inputIdleTimer.current) clearTimeout(inputIdleTimer.current);
    inputIdleTimer.current = setTimeout(() => {
      // Only auto-collapse if we are not actively loading/generating
      if (!isLoading) setInputCollapsed(true);
    }, 15000);
  };
  useEffect(() => {
    const handleGlobalInteraction = () => resetInputTimer();
    window.addEventListener("mousemove", handleGlobalInteraction);
    window.addEventListener("keydown", handleGlobalInteraction);
    resetInputTimer();
    return () => {
      window.removeEventListener("mousemove", handleGlobalInteraction);
      window.removeEventListener("keydown", handleGlobalInteraction);
      if (inputIdleTimer.current) clearTimeout(inputIdleTimer.current);
    };
  }, [isLoading]);

  // ── Restore view preference ─────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_PREF_KEY) as ViewMode | null;
    if (saved) { setViewMode(saved); setUserSetView(true); }
  }, []);

  // ── Load history from Firestore ───────────────────────────
  useEffect(() => {
    if (!user) return;
    setHistoryLoaded(false);
    loadPrompts(user.uid)
      .then(h => { setHistory(h); setHistoryLoaded(true); })
      .catch(err => {
        console.error("History load failed:", err);
        setHistoryLoaded(true); // still mark done so UI doesn't spin
        // Retry once more after 2s (handles cold-start auth delay)
        setTimeout(() => {
          loadPrompts(user.uid).then(h => setHistory(h)).catch(() => {});
        }, 2000);
      });
    trackEvent({ uid: user.uid, event: "session_start" });
  }, [user]);

  // ── Load learned keywords for suggestion panel ────────────
  useEffect(() => {
    if (!user) return;
    const url = activeSpecialist
      ? `/api/keywords?uid=${user.uid}&specialistId=${activeSpecialist.slotId}`
      : `/api/keywords?uid=${user.uid}`;
    fetch(url).then(r => r.json()).then(({ keywords: kws }) =>
      setLearnedKws((kws ?? []).map((k: { word: string }) => k.word))
    ).catch(() => {});
  }, [user, activeSpecialist, chipsRefresh]);

  // ── Global Config & Announcement ─────────────────────────
  useEffect(() => {
    fetch("/api/public-config").then(r => r.json()).then(d => {
      if (d.announcement?.enabled) setAnnouncement(d.announcement);
      if (d.features) setFeatures({ splitView: d.features.splitView??true, history: d.features.history??true, imageUpload: d.features.imageUpload??true });
    }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── View change (user-driven only) ──────────────────────────
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    setUserSetView(true);
    localStorage.setItem(VIEW_PREF_KEY, mode);
    if (mode === "split" && user) trackEvent({ uid: user.uid, event: "split_view_opened" });
  };

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
    setInputCollapsed(true);

    if (user) {
      trackEvent({ uid: user.uid, event: "prompt_generated", metadata: { specialist: activeSpecialist?.name ?? "none", hasImages: images.length > 0 } });
    }

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

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.rawError
          ? `${errData.error}\n\nDetails: ${errData.rawError}`
          : errData.error || "Request failed");
      }
      const { engineeredPrompt, explanation } = await res.json();

      setMessages(prev => prev.map(m =>
        m.id === aid ? { ...m, engineeredPrompt, explanation, content: "", isLoading: false, timestamp: Date.now() } : m
      ));
      setLatestPrompt({ engineeredPrompt, originalIdea: idea });
      // ✅ NO auto view switch — user controls this

      const entry: HistoryEntry = {
        id: uuidv4(), title: idea.slice(0, 55) + (idea.length > 55 ? "…" : ""),
        engineeredPrompt, originalIdea: idea, timestamp: Date.now(),
        category: detectCategory(idea),
        specialist: activeSpecialist?.slotId,
      };
      if (user) {
        savePrompt(user.uid, entry).catch(err => console.error("Save failed:", err));
        setHistory(prev => [entry, ...prev.filter(e => e.id !== entry.id)]);

        const keywords = extractKeywords(engineeredPrompt + " " + idea);
        if (keywords.length > 0) {
          fetch("/api/keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: user.uid, keywords, specialistId: activeSpecialist?.slotId }),
          }).catch(() => {});
          setChipsRefresh(n => n + 1);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg, { duration: 6000 });
      if (user) trackEvent({ uid: user.uid, event: "error_occurred", metadata: { msg: msg.slice(0, 50) } });
      setMessages(prev => prev.filter(m => m.id !== aid));
      setInputCollapsed(false);
    } finally {
      setIsLoading(false);
    }
  }, [user, history, activeSpecialist]);

  const handleSelectHistory = (entry: HistoryEntry) => {
    setSelectedId(entry.id);
    setLatestPrompt({ engineeredPrompt: entry.engineeredPrompt, originalIdea: entry.originalIdea });
    if (!userSetView) { setViewMode("split"); localStorage.setItem(VIEW_PREF_KEY, "split"); }
    if (user) trackEvent({ uid: user.uid, event: "history_opened" });
    setMessages([
      { id: uuidv4(), role: "user", content: entry.originalIdea, timestamp: entry.timestamp },
      { id: uuidv4(), role: "ai",  content: "", engineeredPrompt: entry.engineeredPrompt, timestamp: entry.timestamp },
    ]);
    setInputCollapsed(false);
  };

  const handleNewChat = () => {
    setMessages([]); 
    setSelectedId(undefined); 
    setLatestPrompt(null); 
    setInputCollapsed(false);
    setAppendText("");
    setSpecialist(null);
  };

  const handleInsert = (text: string) => {
    setAppendText(text);
    setInputCollapsed(false);
    if (user) trackEvent({ uid: user.uid, event: "chip_clicked", metadata: { word: text } });
  };

  const handleSpecialistActivate = (s: Specialist | null) => {
    setSpecialist(s);
    setChipsRefresh(n => n + 1);
    if (s && user) trackEvent({ uid: user.uid, event: "specialist_activated", metadata: { name: s.name } });
  };

  const isEmpty    = messages.length === 0;
  const annColor   = announcement?.type === "error" ? "#f87171" : announcement?.type === "warning" ? "#fbbf24" : announcement?.type === "success" ? "#4ade80" : "#818cf8";
  const annBg      = announcement?.type === "error" ? "rgba(239,68,68,.1)" : announcement?.type === "warning" ? "rgba(245,158,11,.1)" : announcement?.type === "success" ? "rgba(34,197,94,.1)" : "rgba(99,102,241,.1)";

  return (
    <AuthGuard>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {features.history && (
        <Sidebar
          history={history}
          selectedId={selectedId}
          onSelectHistory={handleSelectHistory}
          onNewChat={handleNewChat}
          onDeleteHistory={id => {
            if (user) deletePrompt(user.uid, id).catch(() => {});
            setHistory(p => p.filter(e => e.id !== id));
            if (selectedId === id) handleNewChat();
          }}
        />
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Header activeSpecialist={activeSpecialist} onActivate={handleSpecialistActivate} />

        {/* Announcement */}
        {announcement?.enabled && (
          <div style={{ padding: "7px 16px", background: annBg, borderBottom: `1px solid ${annColor}33`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: annColor, marginRight: 8 }}>{announcement.title}</span>
              <span style={{ fontSize: 12.5, color: "var(--tx-2)" }}>{announcement.message}</span>
            </div>
            <button onClick={() => setAnnouncement(null)} style={{ background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* View toggle — user-controlled only (if feature enabled) */}
        {latestPrompt && features.splitView && (
          <div style={{ display: "flex", alignItems: "center", padding: "5px 16px", borderBottom: "1px solid var(--border)", background: "rgba(17,17,22,0.8)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
            <div className="view-tabs">
              {(["chat", "split"] as ViewMode[]).map(m => (
                <button key={m} onClick={() => handleViewChange(m)} className={`view-tab${viewMode === m ? " active" : ""}`}>
                  {m === "chat" ? <MessageSquare size={11}/> : <Layers size={11}/>}
                  {m === "chat" ? "Chat" : "Split View"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content + Smart Panel row */}
        <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>

          {/* Main area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

            {/* Chat / Split content */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {viewMode === "split" && latestPrompt ? (
                <div className="flex-1 scroll" style={{ padding: 20, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
                  <SplitPreview engineeredPrompt={latestPrompt.engineeredPrompt} originalIdea={latestPrompt.originalIdea} />
                </div>
              ) : (
                <div className="flex-1 scroll" style={{ height: "100%", overflowY: "auto" }}>
                  {isEmpty ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 24px", gap: 20 }}>
                      <div className="empty-icon"><Zap size={22} color="var(--accent-fg)"/></div>
                      <div style={{ textAlign: "center", maxWidth: 480 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--tx-1)", letterSpacing: "-.025em", marginBottom: 10 }}>
                          Engineer your perfect prompt
                        </h1>
                        <p style={{ fontSize: 14.5, color: "var(--tx-2)", lineHeight: 1.7 }}>
                          {activeSpecialist
                            ? `${activeSpecialist.emoji} ${activeSpecialist.name} mode active — describe your idea`
                            : "Describe any raw idea and get a ready-to-paste AI prompt for ChatGPT, Claude, Midjourney, DALL·E, and more."}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 420 }}>
                        {["🎭 Persona-driven","🌐 Context-rich","📋 Task-specific","🖼️ Vision aware","⚡ Copy-ready","🔀 Split preview"].map(f => (
                          <span key={f} style={{ fontSize: 12, color: "var(--tx-3)", background: "var(--bg-card)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: "var(--rf)" }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxWidth: 740, margin: "0 auto", width: "100%", padding: "28px 20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
                      {messages.map(msg => <MessageBubble key={msg.id} message={msg}/>)}
                      <div ref={bottomRef}/>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Input area ─────────────────── */}
            <div style={{
              flexShrink: 0,
              background: "rgba(11,11,14,0.95)",
              backdropFilter: "blur(16px)",
              borderTop: "1px solid var(--border)",
              padding: inputCollapsed ? "6px 16px" : "10px 16px 14px",
              transition: "padding .2s ease",
            }}>
              <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                {inputCollapsed ? (
                  <button
                    onClick={() => setInputCollapsed(false)}
                    style={{
                      width: "100%", padding: "9px 16px", borderRadius: 12,
                      background: "rgba(255,255,255,.035)", border: "1px dashed rgba(255,255,255,.12)",
                      color: "var(--tx-3)", fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all .15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,.1)"; e.currentTarget.style.borderColor = "rgba(99,102,241,.35)"; e.currentTarget.style.color = "#a5b4fc"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.035)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.12)"; e.currentTarget.style.color = "var(--tx-3)"; }}
                  >
                    <Zap size={13} color="var(--accent-fg)"/>
                    <span>Click to type another prompt…</span>
                  </button>
                ) : (
                  <>
                    {/* Module Keywords — collapsible */}
                    {user && (
                      <div style={{ position: "relative" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                          {/* Left: Overall Minimize Panel Arrow */}
                          <button
                            onClick={() => setInputCollapsed(true)}
                            title="Minimize input panel"
                            style={{ position: "absolute", top: -18, left: 0, zIndex: 10, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(234,179,8,.15)", color: "#eab308", border: "1px solid rgba(234,179,8,.3)", borderRadius: 6, cursor: "pointer", transition: "all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(234,179,8,.25)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(234,179,8,.15)"; }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                          </button>

                          {/* Right: Hide Chips Toggle */}
                          <button
                            onClick={() => setChipsCollapsed(c => !c)}
                            style={{ fontSize: 10.5, color: "var(--tx-3)", background: "none", border: "none", cursor: "pointer", padding: "1px 6px", opacity: .6 }}
                            title={chipsCollapsed ? "Show keywords" : "Hide keywords"}
                          >
                            {chipsCollapsed ? "▲ Keywords" : "▼ Hide"}
                          </button>
                        </div>
                        {!chipsCollapsed && (
                          <LearningChips
                            uid={user.uid}
                            specialistId={activeSpecialist?.slotId}
                            onChipClick={handleInsert}
                            refreshTrigger={chipsRefresh}
                          />
                        )}
                      </div>
                    )}

                    <ChatInput
                      key={selectedId ?? "new_chat_key"}
                      onSend={handleSend}
                      isLoading={isLoading}
                      appendText={appendText}
                      onClearAppend={() => setAppendText("")}
                      initialValue={""}
                      onClearInitial={() => {}}
                      disableImage={!features.imageUpload}
                    />

                    {/* Specialist indicator */}
                    {activeSpecialist && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#818cf8" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: "pulse 2s ease-in-out infinite", display: "inline-block" }}/>
                        <span>{activeSpecialist.emoji} {activeSpecialist.name} specialist active</span>
                        <button onClick={() => setSpecialist(null)} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 11, marginLeft: 2 }}>✕</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Smart Suggestion Panel (right side) ─────────── */}
          <SmartSuggestionPanel
            activeSpecialist={activeSpecialist}
            userKeywords={learnedKeywords}
            onInsert={handleInsert}
          />
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}

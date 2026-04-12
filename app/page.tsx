"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { Layers, MessageSquare, Zap } from "lucide-react";

import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ChatInput, { UploadedImage } from "@/components/ChatInput";
import MessageBubble, { Message } from "@/components/MessageBubble";
import TemplateButtons from "@/components/TemplateButtons";
import SplitPreview from "@/components/SplitPreview";
import { HistoryEntry, detectCategory } from "@/lib/history";
import { savePrompt, loadPrompts, deletePrompt } from "@/lib/firestore-history";
import { useAuth } from "@/lib/auth-context";

type ViewMode = "chat" | "split";

// Quick Action chips — appended to the prompt
const QUICK_ACTIONS = [
  { label: "16:9 Ratio",      value: "aspect ratio 16:9" },
  { label: "9:16 Vertical",   value: "aspect ratio 9:16, vertical format" },
  { label: "4K Quality",      value: "4K ultra HD quality" },
  { label: "Hyperrealistic",  value: "hyperrealistic, photorealistic" },
  { label: "Cinematic",       value: "cinematic lighting, dramatic shadows" },
  { label: "Midjourney",      value: "--v 6 --ar 16:9 --style raw" },
  { label: "Dark Mode UI",    value: "dark mode UI/UX design" },
  { label: "Step by Step",    value: "explain step by step with examples" },
  { label: "JSON Output",     value: "output as valid JSON" },
  { label: "Bullet Points",   value: "format response as concise bullet points" },
  { label: "Professional",    value: "formal professional tone" },
  { label: "Creative",        value: "creative and imaginative style" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [messages, setMessages]         = useState<Message[]>([]);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [templateIdea, setTemplateIdea] = useState("");
  const [appendText, setAppendText]     = useState("");
  const [selectedId, setSelectedId]     = useState<string | undefined>();
  const [viewMode, setViewMode]         = useState<ViewMode>("chat");
  const [latestPrompt, setLatestPrompt] = useState<{ engineeredPrompt: string; originalIdea: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load history from Firestore on mount
  useEffect(() => {
    if (user) loadPrompts(user.uid).then(setHistory).catch(() => {});
  }, [user]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = useCallback(async (idea: string, images: UploadedImage[]) => {
    if (!idea.trim() && images.length === 0) return;
    const uid = uuidv4(), aid = uuidv4();

    setMessages(prev => [
      ...prev,
      { id: uid, role: "user",  content: idea, images, timestamp: Date.now() },
      { id: aid, role: "ai",   content: "", isLoading: true, timestamp: Date.now() },
    ]);
    setIsLoading(true); setViewMode("chat");

    try {
      const res = await fetch("/api/engineer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, images: images.map(i => ({ data: i.data, mimeType: i.mimeType })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      const { engineeredPrompt, explanation } = await res.json();

      setMessages(prev => prev.map(m =>
        m.id === aid ? { ...m, engineeredPrompt, explanation, content: "", isLoading: false, timestamp: Date.now() } : m
      ));
      setLatestPrompt({ engineeredPrompt, originalIdea: idea });

      const entry: HistoryEntry = {
        id: uuidv4(),
        title: idea.slice(0, 55) + (idea.length > 55 ? "…" : ""),
        engineeredPrompt, originalIdea: idea,
        timestamp: Date.now(),
        category: detectCategory(idea),
      };
      if (user) {
        await savePrompt(user.uid, entry);
        setHistory(prev => [entry, ...prev.filter(e => e.id !== entry.id)]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setMessages(prev => prev.filter(m => m.id !== aid));
    } finally { setIsLoading(false); }
  }, [user]);

  const handleTemplateSelect = useCallback((idea: string, _type: string) => {
    setTemplateIdea(idea);
    setTimeout(() => handleSend(idea, []), 120);
  }, [handleSend]);

  const handleSelectHistory = (entry: HistoryEntry) => {
    setSelectedId(entry.id);
    setLatestPrompt({ engineeredPrompt: entry.engineeredPrompt, originalIdea: entry.originalIdea });
    setViewMode("split");
    setMessages([
      { id: uuidv4(), role: "user", content: entry.originalIdea, timestamp: entry.timestamp },
      { id: uuidv4(), role: "ai",  content: "", engineeredPrompt: entry.engineeredPrompt, timestamp: entry.timestamp },
    ]);
  };

  const handleNewChat = () => {
    setMessages([]); setSelectedId(undefined); setLatestPrompt(null); setViewMode("chat");
  };

  const isEmpty = messages.length === 0;

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
        <Header />

        {/* View toggle */}
        {latestPrompt && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 20px", borderBottom: "1px solid var(--border)",
            background: "rgba(17,17,22,0.7)", backdropFilter: "blur(12px)", flexShrink: 0,
          }}>
            <div className="view-tabs">
              {(["chat", "split"] as ViewMode[]).map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`view-tab${viewMode === m ? " active" : ""}`}>
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
                /* Welcome state */
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%",
                  padding: "40px 24px", gap: 24,
                }}>
                  <div className="empty-icon">
                    <Zap size={22} color="var(--accent-fg)" />
                  </div>

                  <div style={{ textAlign: "center", maxWidth: 500 }}>
                    <h1 style={{
                      fontSize: 26, fontWeight: 700, color: "var(--tx-1)",
                      letterSpacing: "-.025em", lineHeight: 1.25, marginBottom: 10,
                    }}>
                      Engineer your perfect prompt
                    </h1>
                    <p style={{ fontSize: 14.5, color: "var(--tx-2)", lineHeight: 1.7 }}>
                      Describe any raw idea and get a single, ready-to-paste AI prompt —
                      crafted for ChatGPT, Claude, Midjourney, DALL·E, and more.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 480 }}>
                    {["🎭 Persona-driven","🌐 Context-rich","📋 Task-specific","🖼️ Vision aware","⚡ Copy-ready","🔀 Split preview"].map(f => (
                      <span key={f} style={{
                        fontSize: 12, color: "var(--tx-3)",
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        padding: "4px 10px", borderRadius: "var(--rf)",
                      }}>{f}</span>
                    ))}
                  </div>

                  <TemplateButtons onSelect={handleTemplateSelect} disabled={isLoading} />
                </div>
              ) : (
                <div style={{
                  maxWidth: 760, margin: "0 auto", width: "100%",
                  padding: "32px 20px", display: "flex", flexDirection: "column", gap: 28,
                }}>
                  {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          )}

          {/* ── Input area ─────────────────────────── */}
          <div style={{
            flexShrink: 0, background: "rgba(11,11,14,0.9)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid var(--border)",
            padding: "10px 20px 16px",
          }}>
            <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Templates row */}
              {!isEmpty && (
                <TemplateButtons onSelect={handleTemplateSelect} disabled={isLoading} />
              )}

              {/* Quick Action bar */}
              <div className="quick-bar">
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.label}
                    onClick={() => { setAppendText(a.value); }}
                    disabled={isLoading}
                    className="quick-chip"
                    title={`Append: "${a.value}"`}
                  >
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
            </div>
          </div>
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}

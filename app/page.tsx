"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { Layers, MessageSquare, Zap } from "lucide-react";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ChatInput, { UploadedImage } from "@/components/ChatInput";
import MessageBubble, { Message } from "@/components/MessageBubble";
import TemplateButtons from "@/components/TemplateButtons";
import SplitPreview from "@/components/SplitPreview";
import { HistoryEntry, loadHistory, saveToHistory } from "@/lib/history";

type ViewMode = "chat" | "split";

export default function HomePage() {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [templateIdea, setTemplateIdea] = useState("");
  const [selectedId, setSelectedId]     = useState<string | undefined>();
  const [viewMode, setViewMode]         = useState<ViewMode>("chat");
  const [latestPrompt, setLatestPrompt] = useState<{ engineeredPrompt: string; originalIdea: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);
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
        m.id === aid ? { ...m, engineeredPrompt, explanation, content: explanation || "", isLoading: false, timestamp: Date.now() } : m
      ));
      setLatestPrompt({ engineeredPrompt, originalIdea: idea });

      const entry: HistoryEntry = {
        id: uuidv4(), title: idea.slice(0, 55) + (idea.length > 55 ? "…" : ""),
        engineeredPrompt, originalIdea: idea, timestamp: Date.now(),
      };
      saveToHistory(entry); setHistory(loadHistory());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setMessages(prev => prev.filter(m => m.id !== aid));
    } finally { setIsLoading(false); }
  }, []);

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

  const handleDeleteHistory = (id: string) => {
    setHistory(p => p.filter(e => e.id !== id));
    if (selectedId === id) handleNewChat();
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Sidebar */}
      <Sidebar
        history={history} selectedId={selectedId}
        onSelectHistory={handleSelectHistory}
        onNewChat={handleNewChat}
        onDeleteHistory={handleDeleteHistory}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Header />

        {/* View mode toggle */}
        {latestPrompt && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 20px", borderBottom: "1px solid var(--border)",
            background: "var(--bg-panel)", flexShrink: 0,
          }}>
            <div className="view-tabs">
              {(["chat", "split"] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`view-tab${viewMode === mode ? " active" : ""}`}>
                  {mode === "chat" ? <MessageSquare size={11} /> : <Layers size={11} />}
                  {mode === "chat" ? "Chat" : "Split View"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Split view */}
          {viewMode === "split" && latestPrompt ? (
            <div className="scroll flex-1" style={{ padding: 20 }}>
              <SplitPreview engineeredPrompt={latestPrompt.engineeredPrompt} originalIdea={latestPrompt.originalIdea} />
            </div>
          ) : (
            /* Chat view */
            <div className="flex-1 scroll">
              {isEmpty ? (
                /* Empty / welcome state */
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%",
                  padding: "40px 24px", gap: 28,
                }}>
                  {/* Icon */}
                  <div className="empty-icon">
                    <Zap size={22} color="var(--accent-fg)" />
                  </div>

                  <div style={{ textAlign: "center", maxWidth: 480 }}>
                    <h1 style={{
                      fontSize: 24, fontWeight: 700, color: "var(--tx-1)",
                      letterSpacing: "-.025em", lineHeight: 1.3, marginBottom: 10,
                    }}>
                      Engineer your perfect prompt
                    </h1>
                    <p style={{ fontSize: 14.5, color: "var(--tx-2)", lineHeight: 1.7 }}>
                      Describe any raw idea and I&apos;ll transform it into a structured,
                      professional AI prompt using Role-play, Context &amp; Constraints techniques.
                    </p>
                  </div>

                  {/* Feature tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 440 }}>
                    {["🎭 Role-play personas","🌐 Rich context","📋 Structured tasks","🖼️ Vision support","🔀 Split preview","📋 Copy anywhere"].map(f => (
                      <span key={f} style={{
                        fontSize: 12, color: "var(--tx-3)",
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        padding: "4px 10px", borderRadius: "var(--rf)",
                      }}>{f}</span>
                    ))}
                  </div>

                  {/* Templates */}
                  <TemplateButtons onSelect={handleTemplateSelect} disabled={isLoading} />
                </div>
              ) : (
                /* Messages list */
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

          {/* Input bar */}
          <div style={{
            flexShrink: 0, background: "var(--bg)", padding: "12px 20px 16px",
            borderTop: "1px solid var(--border)",
          }}>
            <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              {!isEmpty && (
                <TemplateButtons onSelect={handleTemplateSelect} disabled={isLoading} />
              )}
              <ChatInput
                onSend={handleSend} isLoading={isLoading}
                initialValue={templateIdea} onClearInitial={() => setTemplateIdea("")}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

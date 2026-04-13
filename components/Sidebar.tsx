"use client";
import { useState } from "react";
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, Clock, Zap } from "lucide-react";
import { HistoryEntry, deleteFromHistory, formatTimestamp, CATEGORY_META } from "@/lib/history";

interface Props {
  history: HistoryEntry[];
  onSelectHistory: (e: HistoryEntry) => void;
  onNewChat: () => void;
  onDeleteHistory: (id: string) => void;
  selectedId?: string;
}

export default function Sidebar({ history, onSelectHistory, onNewChat, onDeleteHistory, selectedId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const del = (ev: React.MouseEvent, id: string) => {
    ev.stopPropagation();
    deleteFromHistory(id);
    onDeleteHistory(id);
  };

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`} style={{ position: "relative" }}>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: "absolute", right: -1, top: 58, zIndex: 20,
          width: 18, height: 34, background: "var(--bg-panel)",
          border: "1px solid var(--border)", borderLeft: "none",
          borderRadius: "0 5px 5px 0",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--tx-3)", cursor: "pointer", transition: "color .15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--tx-2)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--tx-3)")}
      >
        {collapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
      </button>

      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "14px 14px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: "var(--accent-dim)", border: "1px solid var(--accent-brd)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={13} color="var(--accent-fg)" />
        </div>
        {!collapsed && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-.01em" }}>
            PromptForge
          </span>
        )}
      </div>

      {/* New prompt */}
      <div style={{ padding: "10px 10px 6px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={onNewChat}
          className="sidebar-new-btn"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
          title="New Chat"
        >
          <Plus size={14} style={{ flexShrink: 0 }} />
          {!collapsed && "New Chat"}
        </button>
      </div>

      {/* History label */}
      {!collapsed && history.length > 0 && (
        <div style={{
          padding: "6px 14px 3px", fontSize: 10.5, fontWeight: 700,
          letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx-3)", flexShrink: 0,
        }}>
          History
        </div>
      )}

      {/* History list */}
      <div className="flex-1 scroll" style={{ padding: "2px 6px 10px" }}>
        {history.length === 0 && !collapsed && (
          <div style={{ padding: "28px 12px", textAlign: "center", fontSize: 12.5, color: "var(--tx-3)", lineHeight: 1.7 }}>
            <MessageSquare size={20} style={{ margin: "0 auto 8px", opacity: .3 }} />
            No chats yet.<br/>Start a prompt above!
          </div>
        )}

        {history.map(entry => {
          const cat = CATEGORY_META[entry.category ?? "general"];
          return (
            <button
              key={entry.id}
              onClick={() => onSelectHistory(entry)}
              onMouseEnter={() => setHoverId(entry.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`sidebar-item${selectedId === entry.id ? " active" : ""}`}
              title={collapsed ? entry.title : undefined}
            >
              {/* Category emoji or dot */}
              {collapsed ? (
                <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{cat.emoji}</span>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>{cat.emoji}</span>
                  </div>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--tx-1)" }}>
                      {entry.title}
                    </div>
                    <div style={{
                      fontSize: 11, color: "var(--tx-3)",
                      display: "flex", alignItems: "center", gap: 4, marginTop: 2,
                    }}>
                      <Clock size={9} />
                      {formatTimestamp(entry.timestamp)}
                      <span style={{ color: cat.color, fontWeight: 600, marginLeft: 2 }}>
                        {cat.label}
                      </span>
                    </div>
                  </div>
                  {hoverId === entry.id && (
                    <button onClick={e => del(e, entry.id)} className="icon-btn" style={{ width: 22, height: 22, flexShrink: 0 }}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

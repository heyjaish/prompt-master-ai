"use client";
import CopyableBlock from "./CopyableBlock";
import { UploadedImage } from "./ChatInput";

export interface Message {
  id: string; role: "user" | "ai"; content: string;
  engineeredPrompt?: string; explanation?: string;
  images?: UploadedImage[]; timestamp: number; isLoading?: boolean;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LoadingCard() {
  return (
    <div className="loading-card anim-in">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <span style={{ fontSize: 12, color: "var(--tx-3)" }}>Engineering your prompt…</span>
      </div>
      {[100, 80, 90, 60, 75].map((w, i) => (
        <div key={i} className="shimmer-line" style={{ width: `${w}%`, animationDelay: `${i * .1}s` }} />
      ))}
    </div>
  );
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`msg-row anim-up${isUser ? " user" : ""}`}>
      <div className={`avatar ${isUser ? "avatar-user" : "avatar-ai"}`}>
        {isUser ? "U" : "AI"}
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 42px)", display: "flex", flexDirection: "column", gap: 8 }}>
        {isUser ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {message.images && message.images.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {message.images.map((img, i) => (
                  <div key={i} className="img-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt={img.name} />
                  </div>
                ))}
              </div>
            )}
            {message.content && <div className="bubble-user">{message.content}</div>}
            <span style={{ fontSize: 11, color: "var(--tx-3)" }}>{fmt(message.timestamp)}</span>
          </div>
        ) : (
          <>
            {message.isLoading && <LoadingCard />}

            {!message.isLoading && message.engineeredPrompt && (
              <CopyableBlock content={message.engineeredPrompt} explanation={message.explanation} />
            )}

            {!message.isLoading && !message.engineeredPrompt && message.content && (
              <div style={{ fontSize: 14, color: "var(--tx-2)", lineHeight: 1.65 }}>{message.content}</div>
            )}

            {!message.isLoading && (
              <span style={{ fontSize: 11, color: "var(--tx-3)" }}>
                Prompt Master · {fmt(message.timestamp)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

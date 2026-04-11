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

function Dots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 4px" }}>
      {[0,1,2].map(i => (
        <span key={i} className="dot" style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--tx-3)", display: "inline-block",
        }} />
      ))}
    </div>
  );
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`msg-row anim-up${isUser ? " user" : ""}`}>
      {/* Avatar */}
      <div className={`avatar ${isUser ? "avatar-user" : "avatar-ai"}`}>
        {isUser ? "U" : "AI"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 42px)", display: "flex", flexDirection: "column", gap: 8 }}>
        {isUser ? (
          <div style={{ display: "flex", justifyContent: "flex-end", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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
            {message.isLoading && <Dots />}

            {!message.isLoading && message.engineeredPrompt && (
              <CopyableBlock content={message.engineeredPrompt} />
            )}

            {!message.isLoading && message.explanation && (
              <div className="why-box">
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx-3)", marginBottom: 5 }}>
                  Why this works
                </div>
                {message.explanation}
              </div>
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

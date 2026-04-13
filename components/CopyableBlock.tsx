"use client";
import { useState, useCallback } from "react";
import { Copy, Check, Download, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

interface Props { content: string; explanation?: string; }

export default function CopyableBlock({ content, explanation }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
      import("../lib/error-logger").then(({ logFrontendError }) => {
        logFrontendError({ errorType: "copy_failed", errorMessage: err instanceof Error ? err.message : String(err), severity: "Low", userAction: "Copy Prompt" });
      });
    }
  }, [content]);

  const download = useCallback(() => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download = "prompt.txt"; a.click();
    toast.success("Saved as prompt.txt");
  }, [content]);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <div className="prompt-card anim-up">
      {/* Header */}
      <div className="prompt-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={13} color="var(--accent-fg)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-fg)", letterSpacing: ".04em" }}>
            ENGINEERED PROMPT
          </span>
          <span style={{
            fontSize: 10.5, color: "var(--tx-3)",
            background: "var(--bg-active)", padding: "2px 7px", borderRadius: "var(--rf)",
          }}>
            {wordCount}w · {charCount}c
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={download} className="icon-btn" style={{ width: 28, height: 28 }} title="Download">
            <Download size={12} />
          </button>
          <button onClick={copy} className={`copy-btn ${copied ? "done" : "idle"}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Prompt"}
          </button>
        </div>
      </div>

      {/* Prompt body */}
      <div className="prompt-card-body">{content}</div>

      {/* Tip line */}
      {explanation && (
        <div className="prompt-tip">
          <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
          <span>{explanation}</span>
        </div>
      )}
    </div>
  );
}

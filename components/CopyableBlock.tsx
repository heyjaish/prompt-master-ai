"use client";
import { useState, useCallback } from "react";
import { Copy, Check, Download } from "lucide-react";
import toast from "react-hot-toast";

interface Props { content: string; label?: string; }

export default function CopyableBlock({ content, label = "Engineered Prompt" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(content).catch(() => null);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const download = useCallback(() => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download = "prompt.txt"; a.click();
    toast.success("Downloaded");
  }, [content]);

  const lines = content.split("\n");

  return (
    <div className="prompt-block anim-up">
      <div className="prompt-block-header">
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--tx-2)" }}>{label}</span>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={download} className="icon-btn" style={{ width: 28, height: 28 }} title="Download">
            <Download size={12} />
          </button>
          <button onClick={copy} className={`copy-btn ${copied ? "done" : "idle"}`}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="prompt-block-body">
        {lines.map((line, i) =>
          line.startsWith("## ") ? (
            <span key={i} className="section-label">{line.replace("## ", "")}</span>
          ) : line.trim() === "" ? (
            <div key={i} style={{ height: 4 }} />
          ) : (
            <div key={i}>{line}</div>
          )
        )}
      </div>
    </div>
  );
}

"use client";
import { Briefcase, Code2, PlayCircle } from "lucide-react";

export const TEMPLATES = [
  {
    id: "email", label: "Business Email", icon: <Briefcase size={12} />,
    idea: "Write a professional cold email to a senior executive pitching a new AI-powered product feature, focusing on ROI and competitive advantage.",
  },
  {
    id: "code", label: "Code Expert", icon: <Code2 size={12} />,
    idea: "Explain and implement a real-time collaborative code editor using Next.js, WebSockets, and Monaco Editor with conflict resolution.",
  },
  {
    id: "viral", label: "Viral Script", icon: <PlayCircle size={12} />,
    idea: "Create a viral Instagram Reels script for a tech product unboxing that hooks in 3 seconds and ends with a strong CTA to drive sales.",
  },
];

interface Props { onSelect: (idea: string, type: string) => void; disabled?: boolean; }

export default function TemplateButtons({ onSelect, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--tx-3)" }}>
        Quick start
      </span>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.idea, t.id)}
            disabled={disabled}
            className="tag"
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

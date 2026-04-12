export type PromptCategory = "image" | "video" | "code" | "business" | "creative" | "general";

export interface HistoryEntry {
  id: string;
  title: string;
  engineeredPrompt: string;
  originalIdea: string;
  timestamp: number;
  category: PromptCategory;
}

const KEY = "prompt-master-history";
const MAX = 50;

export function detectCategory(idea: string): PromptCategory {
  const t = idea.toLowerCase();
  if (/\b(image|photo|picture|portrait|illustration|drawing|painting|render|3d|midjourney|dall-e|stable diffusion|artwork|visual|logo|icon|design|ui|mockup|banner|thumbnail)\b/.test(t)) return "image";
  if (/\b(video|reel|script|youtube|tiktok|instagram|film|movie|scene|animation|ad|commercial|short)\b/.test(t)) return "video";
  if (/\b(code|function|api|react|app|website|bug|implement|algorithm|database|sql|python|javascript|typescript|component|refactor|debug)\b/.test(t)) return "code";
  if (/\b(email|letter|proposal|report|business|marketing|sales|campaign|copy|pitch|strategy|plan|memo)\b/.test(t)) return "business";
  if (/\b(story|poem|blog|article|content|write|creative|fiction|novel|essay|caption|tweet|post)\b/.test(t)) return "creative";
  return "general";
}

export const CATEGORY_META: Record<PromptCategory, { label: string; emoji: string; color: string }> = {
  image:    { label: "Image",    emoji: "🖼️", color: "#a855f7" },
  video:    { label: "Video",    emoji: "🎬", color: "#ef4444" },
  code:     { label: "Code",     emoji: "💻", color: "#22c55e" },
  business: { label: "Business", emoji: "💼", color: "#3b82f6" },
  creative: { label: "Creative", emoji: "✍️", color: "#f59e0b" },
  general:  { label: "General",  emoji: "⚡", color: "#7b68ee" },
};

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as HistoryEntry[];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): void {
  const list = loadHistory().filter(e => e.id !== entry.id);
  localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, MAX)));
}

export function deleteFromHistory(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadHistory().filter(e => e.id !== id)));
}

export function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return "Just now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

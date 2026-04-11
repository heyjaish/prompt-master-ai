/* history.ts – localStorage persistence for engineered prompts */

export interface HistoryEntry {
  id: string;
  title: string;
  engineeredPrompt: string;
  originalIdea: string;
  timestamp: number;
}

const KEY = "prompt-master-history";
const MAX = 50;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry): void {
  const list = loadHistory();
  const filtered = list.filter((e) => e.id !== entry.id);
  localStorage.setItem(KEY, JSON.stringify([entry, ...filtered].slice(0, MAX)));
}

export function deleteFromHistory(id: string): void {
  const list = loadHistory().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

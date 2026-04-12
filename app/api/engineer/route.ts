import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
} from "@google/generative-ai";

const BASE_SYSTEM = `You are an elite Prompt Engineer. Your only job is to transform a user's raw idea into a single, masterfully-crafted AI prompt that works immediately.

STRICT OUTPUT RULES:
1. Output ONLY the finished prompt — no sections, no markdown headers, no labels
2. Write as ONE cohesive, dense paragraph packed with specific details
3. Naturally weave in: the AI persona, context, task, tone, style, constraints, and output format — all in flowing prose
4. Make it instantly usable in ChatGPT, Claude, Gemini, Midjourney, DALL-E, or any AI tool
5. Be specific and actionable. Use concrete details (dimensions, counts, colors, styles, lengths)
6. After the prompt, add ONE blank line, then a single line starting with "💡 " giving a 10-15 word insight about the key technique used

DO NOT INCLUDE:
- Markdown headers like ## 🎭 ROLE or ## 📋 TASK
- Labels like "Role:", "Context:", "Task:", "Constraints:"
- Explanatory sections or "Why this works:" commentary
- Multiple separate sections or bullet lists explaining the prompt structure`;

const DEFAULT_MODEL = "gemini-2.0-flash";
const ADMIN_KEY     = process.env.ADMIN_SECRET_KEY ?? "admin-secret-2025";

// Read AI config directly from Firestore (no self-referencing HTTP call)
async function getAIConfig() {
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const pk          = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !pk) return null;
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk }) });
    const snap = await getFirestore(app).collection("config").doc("ai").get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

// Auto-retry on 429 quota errors with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 4000): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.toLowerCase().includes("too many");
    if (isQuota && retries > 0) {
      await new Promise(r => setTimeout(r, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2); // 4s → 8s
    }
    throw e;
  }
}

// ── Multi-key rotation ─────────────────────────────────────────
// Reads GEMINI_API_KEY, GEMINI_API_KEY_2 … GEMINI_API_KEY_10 from env
// Tries each in order — automatically switches on 429 quota errors
function getAllApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys.filter(Boolean);
}

async function generateWithKeyRotation(
  keys: string[], modelName: string, systemInstruction: string,
  temperature: number, maxTokens: number, parts: Part[],
  keyIndex = 0
): Promise<{ text: string; keyUsed: number }> {
  if (keyIndex >= keys.length) throw new Error("ALL_KEYS_EXHAUSTED");
  const genAI = new GoogleGenerativeAI(keys[keyIndex]);
  const model = genAI.getGenerativeModel({
    model: modelName, systemInstruction,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT,  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
  });
  try {
    const result = await withRetry(() => model.generateContent(parts), 1, 3000);
    return { text: result.response.text().trim(), keyUsed: keyIndex + 1 };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.toLowerCase().includes("too many");
    if (isQuota && keyIndex + 1 < keys.length) {
      console.warn(`API key ${keyIndex + 1} quota exceeded — switching to key ${keyIndex + 2}`);
      return generateWithKeyRotation(keys, modelName, systemInstruction, temperature, maxTokens, parts, keyIndex + 1);
    }
    throw e;
  }
}

interface ContextItem { originalIdea: string; engineeredPrompt: string; specialistName?: string; }

export async function POST(req: NextRequest) {
  const keys = getAllApiKeys();
  if (keys.length === 0)
    return NextResponse.json({ error: "No GEMINI_API_KEY configured. Add one at https://aistudio.google.com/app/apikey then set it in Vercel environment variables." }, { status: 500 });

  try {
    const body = await req.json();
    const {
      idea, images, templateType, uid,
      specialistName, specialistPrompt,    // User's custom specialist
      contextHistory,                       // Last 3 prompts for contextual memory
    } = body as {
      idea: string;
      images?: { data: string; mimeType: string }[];
      templateType?: string;
      uid?: string;
      specialistName?: string;
      specialistPrompt?: string;
      contextHistory?: ContextItem[];
    };

    if (!idea?.trim() && (!images || images.length === 0))
      return NextResponse.json({ error: "Please provide a raw idea." }, { status: 400 });

    // ── Check usage limits ─────────────────────────────────────
    if (uid) {
      try {
        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const r = await fetch(`${base}/api/admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
          body: JSON.stringify({ action: "checkPrompt", uid }),
        });
        const d = await r.json();
        if (d.allowed === false) return NextResponse.json({ error: d.reason ?? "Daily limit reached." }, { status: 429 });
      } catch { /* never block */ }
    }

    // ── Get admin AI config ────────────────────────────────────
    const aiCfg      = await getAIConfig();
    const modelName  = aiCfg?.model              ?? DEFAULT_MODEL;
    const temperature= aiCfg?.temperature        ?? 0.7;
    const maxTokens  = aiCfg?.maxTokens          ?? 8192;
    const adminPrefix= aiCfg?.systemPromptPrefix ?? "";

    // ── Build system instruction ───────────────────────────────
    let systemInstruction = adminPrefix ? `${adminPrefix}\n\n${BASE_SYSTEM}` : BASE_SYSTEM;

    // Append specialist context if active
    if (specialistPrompt) {
      systemInstruction += `\n\nSPECIALIST MODE — ${specialistName ?? "Custom"}:\n${specialistPrompt}\nApply this domain expertise to every output. Include domain-specific terminology, tools, standards, and best practices automatically.`;
    }

    // ── Build contextual memory prefix ─────────────────────────
    let contextPrefix = "";
    if (contextHistory && contextHistory.length > 0) {
      const recent = contextHistory.slice(-3);
      contextPrefix = `USER'S RECENT WORK IN THIS DOMAIN (for context — they may be continuing a project):\n`;
      recent.forEach((c, i) => {
        contextPrefix += `${i+1}. They asked: "${c.originalIdea.slice(0,80)}"\n`;
      });
      contextPrefix += `\nIf the new request relates to the above work, continue the same project context naturally.\n\n`;
    }

    // ── Build content parts ────────────────────────────────────
    const parts: Part[] = [];
    const textContent = contextPrefix + (templateType ? `Template Type: ${templateType}\n\n` : "") + `Raw Idea: ${idea}`;
    parts.push({ text: textContent });

    if (images && images.length > 0) {
      parts.push({ text: "\n\nVisual References (analyze these to inform the prompt — extract style, colors, composition, technical specs):" });
      for (const img of images) {
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType as "image/jpeg"|"image/png"|"image/webp"|"image/gif" } });
      }
    }

    // ── Generate with automatic key rotation on quota errors ───
    const { text, keyUsed } = await generateWithKeyRotation(
      keys, modelName, systemInstruction, temperature, maxTokens, parts
    );

    const tipIdx = text.lastIndexOf("\n💡");
    let engineeredPrompt = text, explanation = "";
    if (tipIdx !== -1) {
      engineeredPrompt = text.slice(0, tipIdx).trim();
      explanation      = text.slice(tipIdx).trim().replace(/^💡\s*/, "");
    }

    return NextResponse.json({ engineeredPrompt, explanation, modelUsed: modelName, keyUsed });

  } catch (err: unknown) {
    console.error("Gemini API error:", err);
    let message = "An unexpected error occurred. Please try again.";
    if (err instanceof Error) {
      const raw = err.message;
      if (raw === "ALL_KEYS_EXHAUSTED")
        message = `⚠️ All ${keys.length} API key(s) hit their quota (15 req/min limit). Add more keys as GEMINI_API_KEY_2, GEMINI_API_KEY_3… in Vercel env vars. Or wait ~1 minute.`;
      else if (raw.includes("429") || raw.includes("quota") || raw.toLowerCase().includes("too many"))
        message = "⚠️ Rate limit hit. Auto-retried all keys — please wait ~1 minute and try again.";
      else if (raw.includes("403") || raw.includes("API_KEY_INVALID") || raw.includes("401"))
        message = "🔑 Invalid API key. Check your GEMINI_API_KEY environment variable.";
      else if (raw.includes("404") || raw.includes("not found"))
        message = "🤖 Model not available. Try changing the model in Admin → AI Config.";
      else message = raw.slice(0, 300);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

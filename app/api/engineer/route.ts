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

const DEFAULT_MODEL   = "gemini-2.5-flash-preview-04-17"; // user's primary model
const FALLBACK_MODELS = [
  "gemini-2.5-flash-preview-04-17",  // primary
  "gemini-2.0-flash-lite",           // lighter fallback
  "gemini-1.5-flash",                // most stable backup
];
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "admin-secret-2025";

// ── Read all configured API keys ─────────────────────────────────
// Supports: GEMINI_API_KEY, GEMINI_API_KEY_2 … GEMINI_API_KEY_10
function getAllApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary?.trim()) keys.push(primary.trim());
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k?.trim()) keys.push(k.trim());
  }
  return keys;
}

// ── Read AI config from Firestore ────────────────────────────────
async function getAIConfig() {
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const pk          = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !pk) return null;
    const app = getApps().length ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk }) });
    const snap = await getFirestore(app).collection("config").doc("ai").get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

// ── Quota / rate-limit detection ────────────────────────────────
// Only true 429 rate limits — NOT 403 key errors that mention "quota"
function isQuotaError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  // Must have 429 OR "too many requests" — "quota" alone is NOT enough
  // because 403 errors can also say "quota exceeded" for billing/key issues
  return msg.includes("429") || msg.includes("too many requests") ||
         (msg.includes("resource_exhausted") && !msg.includes("403"));
}

// ── Generate with automatic key rotation ─────────────────────────
// Tries each key in order. On quota error → next key immediately.
async function generateWithKeyRotation(
  keys: string[], modelName: string, systemInstruction: string,
  temperature: number, maxTokens: number, parts: Part[]
): Promise<{ text: string; keyUsed: number }> {
  const keyErrors: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    try {
      console.log(`[KeyRotation] Trying key ${i + 1}/${keys.length} (${keys[i].slice(0, 8)}...)`);
      const genAI = new GoogleGenerativeAI(keys[i]);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT,  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
      });
      const result = await model.generateContent(parts);
      const text   = result.response.text().trim();
      console.log(`[KeyRotation] ✅ Key ${i + 1} succeeded`);
      return { text, keyUsed: i + 1 };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      keyErrors.push(`Key${i + 1}: ${errMsg.slice(0, 200)}`);
      console.warn(`[KeyRotation] Key ${i + 1} failed: ${errMsg.slice(0, 150)}`);

      if (isQuotaError(e)) {
        console.warn(`[KeyRotation] → Quota detected, ${i + 1 < keys.length ? "trying next key" : "all exhausted"}`);
        continue;
      }
      // Non-quota error on first key — still try remaining keys
      if (i + 1 < keys.length) continue;
      break;
    }
  }

  // All keys failed — throw with full per-key details
  throw new Error(`ALL_KEYS_EXHAUSTED:${keys.length}||${keyErrors.join(" | ")}`);
}

interface ContextItem { originalIdea: string; engineeredPrompt: string; }

// Try all keys with one model, then fall back to next model if all quota-exhausted
async function generateWithModelFallback(
  keys: string[], modelsToTry: string[], systemInstruction: string,
  temperature: number, maxTokens: number, parts: Part[]
): Promise<{ text: string; keyUsed: number; modelUsed: string }> {
  for (const modelName of modelsToTry) {
    try {
      const { text, keyUsed } = await generateWithKeyRotation(
        keys, modelName, systemInstruction, temperature, maxTokens, parts
      );
      return { text, keyUsed, modelUsed: modelName };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("ALL_KEYS_EXHAUSTED")) {
        console.warn(`[ModelFallback] All keys exhausted for ${modelName}, trying next model...`);
        continue; // try next model
      }
      throw e;
    }
  }
  throw new Error(`ALL_MODELS_EXHAUSTED||All ${modelsToTry.length} models tried with ${keys.length} keys — all quota exhausted`);
}

export async function POST(req: NextRequest) {
  const keys = getAllApiKeys();
  if (keys.length === 0)
    return NextResponse.json({
      error: "No GEMINI_API_KEY configured. Add one in Vercel Environment Variables → https://aistudio.google.com/app/apikey"
    }, { status: 500 });

  // Hoist so catch block can access uid and modelName for error logging
  let body: {
    idea?: string; images?: { data: string; mimeType: string }[];
    templateType?: string; uid?: string;
    specialistName?: string; specialistPrompt?: string;
    contextHistory?: ContextItem[];
  } = {};
  let modelName = DEFAULT_MODEL; // hoisted for error logging in catch

  try {
    body = await req.json();
    const {
      idea, images, templateType, uid,
      specialistName, specialistPrompt,
      contextHistory,
    } = body;

    if (!idea?.trim() && (!images || images.length === 0))
      return NextResponse.json({ error: "Please provide a raw idea." }, { status: 400 });

    // ── Check usage limits ──────────────────────────────────────
    if (uid) {
      try {
        const base = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const r = await fetch(`${base}/api/admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
          body: JSON.stringify({ action: "checkPrompt", uid }),
        });
        const d = await r.json();
        if (d.allowed === false)
          return NextResponse.json({ error: d.reason ?? "Daily limit reached." }, { status: 429 });
      } catch { /* never block on this */ }
    }

    // ── AI Config ───────────────────────────────────────────────
    const aiCfg       = await getAIConfig();
    modelName   = (aiCfg?.model       as string)  ?? DEFAULT_MODEL;
    const temperature = (aiCfg?.temperature as number)  ?? 0.7;
    const maxTokens   = (aiCfg?.maxTokens   as number)  ?? 8192;
    const adminPrefix = (aiCfg?.systemPromptPrefix as string) ?? "";

    // ── System instruction ──────────────────────────────────────
    let systemInstruction = adminPrefix ? `${adminPrefix}\n\n${BASE_SYSTEM}` : BASE_SYSTEM;
    if (specialistPrompt) {
      systemInstruction += `\n\nSPECIALIST MODE — ${specialistName ?? "Custom"}:\n${specialistPrompt}\nApply this domain expertise to every output.`;
    }

    // ── Contextual memory ──────────────────────────────────────
    let contextPrefix = "";
    if (contextHistory?.length) {
      contextPrefix = `USER'S RECENT WORK IN THIS DOMAIN:\n`;
      contextHistory.slice(-3).forEach((c, i) => {
        contextPrefix += `${i + 1}. They asked: "${c.originalIdea.slice(0, 80)}"\n`;
      });
      contextPrefix += `\nIf related, continue this project context naturally.\n\n`;
    }

    // ── Build parts ─────────────────────────────────────────────
    const parts: Part[] = [];
    parts.push({ text: contextPrefix + (templateType ? `Template Type: ${templateType}\n\n` : "") + `Raw Idea: ${idea}` });

    if (images?.length) {
      parts.push({ text: "\n\nVisual References — extract style, colors, composition, technical specs:" });
      for (const img of images)
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif" } });
    }

    // ── Models to try: admin-configured first, then fallbacks ──
    const modelsToTry = [
      modelName,
      ...FALLBACK_MODELS.filter(m => m !== modelName),
    ];

    // ── Generate: auto key-rotation + model-fallback on quota ───
    const { text, keyUsed, modelUsed } = await generateWithModelFallback(
      keys, modelsToTry, systemInstruction, temperature, maxTokens, parts
    );

    const tipIdx = text.lastIndexOf("\n💡");
    let engineeredPrompt = text, explanation = "";
    if (tipIdx !== -1) {
      engineeredPrompt = text.slice(0, tipIdx).trim();
      explanation      = text.slice(tipIdx).trim().replace(/^💡\s*/, "");
    }

    return NextResponse.json({ engineeredPrompt, explanation, modelUsed, keyUsed });

  } catch (err: unknown) {
    console.error("[Engineer] Error:", err);
    let message = "An unexpected error occurred. Please try again.";
    if (err instanceof Error) {
      const raw = err.message;
      if (raw.startsWith("ALL_KEYS_EXHAUSTED") || raw.startsWith("ALL_MODELS_EXHAUSTED")) {
        const [, details] = raw.split("||");
        message = `⚠️ All API keys and models are quota-exhausted. This usually means Vercel's shared IPs hit Google's rate limit. Please wait 1-2 minutes and try again. Details: ${details?.slice(0, 200) ?? "see Vercel logs"}`;
      } else if (isQuotaError(err)) {
        message = "⚠️ Rate limit hit. Please wait ~1 minute and try again.";
      } else if (raw.includes("403") || raw.includes("API_KEY_INVALID") || raw.includes("401")) {
        message = "🔑 Invalid API key. Check your GEMINI_API_KEY in Vercel environment variables.";
      } else if (raw.includes("404") || raw.includes("not found")) {
        message = "🤖 Model not available. Change the model in Admin → AI Config.";
      } else {
        message = raw.slice(0, 300);
      }
    }
    // ── Auto-log error to admin error monitor ─────────────────
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      // We must await this, or Vercel kills the unawaited fetch immediately when returning
      await fetch(`${base}/api/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
        body: JSON.stringify({
          action: "logError",
          uid:          body?.uid ?? "anonymous",
          email:        "see uid",
          errorType:    err instanceof Error && (err.message.startsWith("ALL_KEYS") || err.message.startsWith("ALL_MODELS")) ? "quota_exhausted"
                      : isQuotaError(err) ? "rate_limit"
                      : err instanceof Error && (err.message.includes("403") || err.message.includes("401")) ? "invalid_key"
                      : "api_error",
          errorMessage: message,
          severity:     err instanceof Error && err.message.startsWith("ALL_MODELS") ? "Critical" : isQuotaError(err) ? "High" : "Medium",
          stack:        err instanceof Error ? err.stack : null,
          userAction:   "AI Generate Prompt",
          specialist:   body?.specialistName ?? null,
          modelUsed:    modelName ?? null,
        }),
      }).catch(e => console.error("Error logging failed:", e));
    } catch { /* never block UI for logging */ }

    return NextResponse.json({
      error: message,
      rawError: err instanceof Error ? err.message.slice(0, 800) : String(err).slice(0, 800)
    }, { status: 500 });
  }
}

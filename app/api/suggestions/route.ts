import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-3-flash-preview";

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

export async function POST(req: NextRequest) {
  try {
    const { history, activeSpecialist, userKeywords, uid } = await req.json();

    const keys = getAllApiKeys();
    if (keys.length === 0) return NextResponse.json({ error: "No API keys configured" }, { status: 500 });
    
    const specialistContext = activeSpecialist 
      ? `Active Specialist: ${activeSpecialist.name} (${activeSpecialist.description})`
      : "No specific specialist active.";

    const historyContext = history?.slice(0, 5).map((h: any) => 
      `- ${h.originalIdea}`
    ).join("\n") || "No history yet.";

    const keywordsContext = userKeywords?.slice(0, 8).join(", ") || "None";

    const prompt = `
      You are an AI Suggestion Brain. Predict what the user needs next based on context.
      
      CONTEXT:
      ${specialistContext}
      HISTORY:
      ${historyContext}
      KEYWORDS:
      ${keywordsContext}

      TASK:
      Generate 8 "suggestions" (actions/goals) and 12 "tips" (modifiers).
      Keep them short (2-4 words).
      
      MATCH THE SPECIALIST TONE:
      - If Image: Creative/Visual modifiers.
      - If Code: Programming tasks.
      - If Business: Professional/Strategy items.

      RETURN JSON ONLY:
      {
        "suggestions": ["...", "..."],
        "tips": ["...", "..."]
      }
    `;

    let lastError = null;
    // Try rotating through keys to avoid 429s
    for (let i = 0; i < keys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(keys[i]);
        const model = genAI.getGenerativeModel({ 
          model: DEFAULT_MODEL,
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 600,
            responseMimeType: "application/json"
          }
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Extract JSON (just in case)
        const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
        const data = JSON.parse(jsonStr);
        
        return NextResponse.json(data);
      } catch (e: any) {
        lastError = e;
        const msg = String(e).toLowerCase();
        // If it's a quota error or rate limit, try next key
        if (msg.includes("429") || msg.includes("quota") || msg.includes("limit")) {
          continue;
        }
        throw e; // If it's a different error, stop
      }
    }

    throw lastError || new Error("All keys failed or exhausted");

  } catch (e) {
    console.error("[Suggestions API] Error:", e);
    // Fallback static data so UI doesn't break
    return NextResponse.json({ 
      suggestions: ["Try a new idea", "Better formatting", "Add context", "Fix typos", "Use headers", "Be specific", "Add constraints", "Optimized view"],
      tips: ["Persona-driven", "Bullet points", "Tone: Formal", "Step-by-step", "Clear goal", "Technical detail", "Brief output", "Creative twist"]
    });
  }
}

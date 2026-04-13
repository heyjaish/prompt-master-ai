import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-1.5-flash";

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
    
    const genAI = new GoogleGenerativeAI(keys[0]);
    const model = genAI.getGenerativeModel({ 
      model: DEFAULT_MODEL,
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
    });

    const specialistContext = activeSpecialist 
      ? `Active Specialist: ${activeSpecialist.name} (${activeSpecialist.description})`
      : "No specific specialist active.";

    const historyContext = history?.slice(0, 10).map((h: any) => 
      `- [${h.category}] ${h.originalIdea}`
    ).join("\n") || "No history yet.";

    const keywordsContext = userKeywords?.slice(0, 10).join(", ") || "None";

    const prompt = `
      You are an AI Suggestion Brain for a Prompt Master SaaS. 
      Your goal is to predict what the user needs next based on their history, active specialist, and keyword style.

      USER CONTEXT:
      ${specialistContext}
      
      USER RECENT HISTORY (Last 10):
      ${historyContext}
      
      FREQUENT KEYWORDS:
      ${keywordsContext}

      TASK:
      Generate two lists of short strings (3-6 words each) that would be helpful for this user.
      
      SECTION 1: AI SUGGESTIONS (High-level quick actions, persona-driven, or goal-oriented)
      - Provide 8 items.
      - Make them highly relevant to the active specialist if one exists.
      - If user is "Code" focused, suggestions should be about features, bugs, or architecture.
      - If user is "Image" focused, suggestions should be about styles, lighting, or specific compositions.
      
      SECTION 2: SMART TIPS (Technical insertions, advanced parameters, or quality boosters)
      - Provide 12 items.
      - These should be modular "insertions" like "TypeScript strict", "Cinematic lighting", "Marketing hook", etc.
      
      RETURN ONLY JSON in this format:
      {
        "suggestions": ["...", "..."],
        "tips": ["...", "..."]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Attempt to extract JSON from text (in case Gemini adds markdown blocks)
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (e) {
    console.error("[Suggestions API] Error:", e);
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({
        errorType: "api_error",
        errorMessage: String(e),
        severity: "Low",
        userAction: "Generate Suggestions",
        route: "/api/suggestions",
        uid: "system"
      });
    } catch {}
    return NextResponse.json({ 
      suggestions: ["Try a new idea", "Better formatting", "Add context", "Fix typos", "Use headers", "Be specific", "Add constraints", "Optimized view"],
      tips: ["Persona-driven", "Bullet points", "Tone: Formal", "Step-by-step", "Clear goal", "Technical detail", "Brief output", "Creative twist"]
    });
  }
}

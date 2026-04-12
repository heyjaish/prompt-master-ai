import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
} from "@google/generative-ai";

const SYSTEM_INSTRUCTION = `You are an elite Prompt Engineer. Your only job is to transform a user's raw idea into a single, masterfully-crafted AI prompt that works immediately.

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
- Multiple separate sections or bullet lists explaining the prompt structure
- "Engineered Prompt:", "Technical Appendix:", or similar meta-text

CORRECT example output:
Act as a world-class UX designer with 15 years of experience at Apple and Google. Design a complete mobile onboarding flow for a fintech app targeting Gen Z users aged 18–25 who distrust traditional banking. Create 5 screens (Welcome, Value Proposition, Identity Verification, Account Setup, First Transaction) in dark mode with glassmorphism cards, a #6366F1-to-#3B82F6 gradient palette, and fluid micro-animations between states. Write specific CTA copy that reduces friction at each step, use progressive disclosure for complex form fields, and include social proof elements (user count, trust badges). Output as a detailed Figma-ready specification including component hierarchy, color tokens, typography scale, and all interaction states.

💡 Persona + constraint stacking forces the AI to reason from expert experience rather than giving generic advice.

WRONG example output (NEVER do this):
## 🎭 ROLE
[AI persona here]
## 🌐 CONTEXT
[Background here]`;

const MODEL_NAME = "gemini-3-flash-preview";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured. Please add it to your .env.local file. Get a free key at https://aistudio.google.com/app/apikey",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { idea, images, templateType } = body as {
      idea: string;
      images?: { data: string; mimeType: string }[];
      templateType?: string;
    };

    if (!idea?.trim()) {
      return NextResponse.json(
        { error: "Please provide a raw idea." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Build content parts
    const parts: Part[] = [];

    // Text part
    let textContent = `Raw Idea: ${idea}`;
    if (templateType) {
      textContent = `Template Type: ${templateType}\n\n${textContent}`;
    }
    parts.push({ text: textContent });

    // Image parts (Gemini vision)
    if (images && images.length > 0) {
      parts.push({
        text: "\n\nVisual References (analyze these to inform the prompt):",
      });
      for (const img of images) {
        parts.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",
          },
        });
      }
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();

    // Split on the 💡 tip line — everything before it is the prompt
    const tipIdx = text.lastIndexOf("\n💡");
    let engineeredPrompt = text;
    let explanation = "";

    if (tipIdx !== -1) {
      engineeredPrompt = text.slice(0, tipIdx).trim();
      explanation = text.slice(tipIdx).trim().replace(/^💡\s*/, "");
    }

    return NextResponse.json({
      engineeredPrompt,
      explanation,
      modelUsed: MODEL_NAME,
    });

  } catch (err: unknown) {
    console.error("Gemini API error:", err);

    let message = "An unexpected error occurred. Please try again.";

    if (err instanceof Error) {
      const raw = err.message;

      if (
        raw.includes("429") ||
        raw.includes("Too Many Requests") ||
        raw.includes("quota")
      ) {
        message =
          "⚠️ API quota exceeded. Your free-tier limit has been reached. Please wait a few hours or create a fresh API key at https://aistudio.google.com/app/apikey";
      } else if (
        raw.includes("403") ||
        raw.includes("API_KEY_INVALID") ||
        raw.includes("not valid") ||
        raw.includes("401")
      ) {
        message =
          "🔑 Invalid API key. Check your GEMINI_API_KEY in .env.local — get one at https://aistudio.google.com/app/apikey";
      } else if (raw.includes("404") || raw.includes("not found")) {
        message =
          "🤖 Model not available. Please check your A PI key has access to gemini-3-flash-preview at https://aistudio.google.com";
      } else {
        message = raw.slice(0, 300);
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
} from "@google/generative-ai";

const SYSTEM_INSTRUCTION = `You are an expert Prompt Engineer. Analyze user text and images to create highly detailed, structured, and effective prompts using Role-play, Context, and Constraints techniques.

When given a raw idea, you must output a perfectly engineered prompt using this structure:

---ENGINEERED PROMPT START---

## 🎭 ROLE
[Define the exact AI persona/role to adopt]

## 🌐 CONTEXT
[Provide rich background, use-case, audience, platform, and goals]

## 📋 TASK
[Crystal-clear description of what the AI must do, step by step]

## ✅ CONSTRAINTS & RULES
[Specific boundaries, tone, format, length, style restrictions]

## 🎯 OUTPUT FORMAT
[Exact format expected — bullet list / JSON / numbered steps / essay / code, etc.]

## 💡 EXAMPLES (if applicable)
[1-2 concrete examples of desired output style]

---ENGINEERED PROMPT END---

After the block, add a brief 2-sentence explanation of why this prompt architecture will be effective.
Always be specific, actionable, and professional. Avoid vague instructions.`;

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
    const text = result.response.text();

    // Parse the structured response
    const startMarker = "---ENGINEERED PROMPT START---";
    const endMarker = "---ENGINEERED PROMPT END---";
    const startIdx = text.indexOf(startMarker);
    const endIdx = text.indexOf(endMarker);

    let engineeredPrompt = text;
    let explanation = "";

    if (startIdx !== -1 && endIdx !== -1) {
      engineeredPrompt = text
        .slice(startIdx + startMarker.length, endIdx)
        .trim();
      explanation = text.slice(endIdx + endMarker.length).trim();
    }

    return NextResponse.json({
      engineeredPrompt,
      explanation,
      fullResponse: text,
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

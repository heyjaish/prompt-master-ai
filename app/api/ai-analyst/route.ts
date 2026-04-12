import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "admin-secret-2025";

// Same key rotation as engineer route
function getAllApiKeys(): string[] {
  const keys: string[] = [];
  const base = process.env.GEMINI_API_KEY;
  if (base) keys.push(base);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

const MODELS_TO_TRY = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

async function generateWithRetry(prompt: string): Promise<string> {
  const keys = getAllApiKeys();
  if (keys.length === 0) throw new Error("No API keys configured");
  const errors: string[] = [];

  for (const model of MODELS_TO_TRY) {
    for (const key of keys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const m = genAI.getGenerativeModel({ model, generationConfig: { temperature: 0.4, maxOutputTokens: 1024 } });
        const result = await m.generateContent(prompt);
        return result.response.text().trim();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
        errors.push(`[${model}] ${msg.slice(0, 120)}`);
        if (!isQuota) throw e; // non-quota errors: fail fast
      }
    }
  }
  throw new Error(`All models/keys exhausted:\n${errors.slice(0,6).join("\n")}`);
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-key") !== ADMIN_KEY)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { question, userData } = await req.json();

    // Fetch fresh data if not provided
    let data = userData;
    if (!data) {
      const { initializeApp, getApps, cert } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const pk          = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (projectId && clientEmail && pk) {
        const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk }) });
        const db  = getFirestore(app);

        const [usersSnap, eventsSnap] = await Promise.all([
          db.collection("users").limit(500).get(),
          db.collection("analytics").where("timestamp", ">", Date.now() - 7*24*60*60*1000).limit(500).get(),
        ]);

        const users  = usersSnap.docs.map(d => d.data());
        const events = eventsSnap.docs.map(d => d.data());
        const today  = new Date().toISOString().slice(0, 10);
        const byEvent: Record<string, number> = {};
        events.forEach(e => { byEvent[e.event as string] = (byEvent[e.event as string] || 0) + 1; });

        data = {
          totalUsers:       users.length,
          activeToday:      users.filter(u => u.dailyDate === today).length,
          planDist:         { free: users.filter(u => u.plan==="free").length, pro: users.filter(u => u.plan==="pro").length, unlimited: users.filter(u => u.plan==="unlimited").length },
          bannedUsers:      users.filter(u => u.status === "banned").length,
          totalPrompts:     users.reduce((s, u) => s + ((u.totalPrompts as number)||0), 0),
          avgPrompts:       users.length ? Math.round(users.reduce((s, u) => s + ((u.totalPrompts as number)||0), 0) / users.length) : 0,
          topUsers:         users.sort((a,b) => ((b.totalPrompts as number)||0) - ((a.totalPrompts as number)||0)).slice(0,3).map(u => ({ prompts: u.totalPrompts })),
          eventBreakdown:   byEvent,
          newUsersThisWeek: users.filter(u => (u.createdAt as number) > Date.now() - 7*24*60*60*1000).length,
        };
      }
    }

    const dataStr = JSON.stringify(data ?? {}, null, 2);
    const prompt = question
      ? `You are a product analytics expert for "PromptForge" (an AI prompt engineering SaaS). Answer this question concisely in 2-4 sentences based on real data:\n\nQuestion: "${question}"\n\nDATA:\n${dataStr}\n\nGive a specific, actionable answer.`
      : `You are a product analytics expert for "PromptForge". Generate exactly 5 specific, actionable insights from this real user data.\n\nDATA:\n${dataStr}\n\nFormat:\n🎯 [Action insight]\n📈 [Growth insight]\n⚠️ [Risk insight]\n💡 [Feature insight]\n🏆 [Power user insight]\n\nBe specific with numbers. Each insight = what the admin should DO.`;

    const insights = await generateWithRetry(prompt);
    return NextResponse.json({ insights, data, generatedAt: Date.now() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.slice(0, 400) }, { status: 500 });
  }
}

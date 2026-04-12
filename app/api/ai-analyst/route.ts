import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "admin-secret-2025";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-key") !== ADMIN_KEY)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { question, userData } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

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

        const [usersSnap, eventsSnap, summarySnap] = await Promise.all([
          db.collection("users").limit(500).get(),
          db.collection("analytics").where("timestamp", ">", Date.now() - 7*24*60*60*1000).limit(500).get(),
          db.collection("analytics").doc("summary").get(),
        ]);

        const users       = usersSnap.docs.map(d => d.data());
        const events      = eventsSnap.docs.map(d => d.data());
        const summary     = summarySnap.exists ? summarySnap.data() : {};
        const today       = new Date().toISOString().slice(0, 10);
        const byEvent: Record<string, number> = {};
        events.forEach(e => { byEvent[e.event as string] = (byEvent[e.event as string] || 0) + 1; });

        data = {
          totalUsers:     users.length,
          activeToday:    users.filter(u => u.dailyDate === today).length,
          planDist:       { free: users.filter(u => u.plan==="free").length, pro: users.filter(u => u.plan==="pro").length, unlimited: users.filter(u => u.plan==="unlimited").length },
          bannedUsers:    users.filter(u => u.status === "banned").length,
          totalPrompts:   users.reduce((s, u) => s + ((u.totalPrompts as number)||0), 0),
          avgPrompts:     users.length ? Math.round(users.reduce((s, u) => s + ((u.totalPrompts as number)||0), 0) / users.length) : 0,
          topUserbyPrompts: users.sort((a,b) => ((b.totalPrompts as number)||0) - ((a.totalPrompts as number)||0)).slice(0,3).map(u => ({ email: u.email, prompts: u.totalPrompts })),
          eventBreakdown: byEvent,
          allTimeSummary: summary,
          newUsersThisWeek: users.filter(u => (u.createdAt as number) > Date.now() - 7*24*60*60*1000).length,
        };
      }
    }

    // Build analysis prompt for Gemini
    const dataStr = JSON.stringify(data, null, 2);
    const analysisPrompt = question
      ? `You are a product analytics expert. Based on this real user data from "Prompt Master AI" (an AI prompt engineering tool), answer this question: "${question}"

USER DATA:
${dataStr}

Give a concise, actionable answer in 2-4 sentences. Focus on what the admin should DO based on this data.`
      : `You are a product analytics expert. Analyze this real user data from "Prompt Master AI" (an AI prompt engineering tool) and generate 5 specific, actionable insights.

USER DATA:
${dataStr}

Format your response as exactly 5 insights, each starting with an emoji and action verb. Be specific with numbers from the data. Each insight should tell the admin what to DO, not just what exists.

Example format:
🎯 [Insight about a specific finding and what to do]
📈 [Growth opportunity insight]
⚠️ [Risk or problem insight]
💡 [Feature/UX improvement insight]
🏆 [Power user insight]`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { temperature: 0.4, maxOutputTokens: 1024 } });
    const result = await model.generateContent(analysisPrompt);
    const insights = result.response.text().trim();

    return NextResponse.json({ insights, data, generatedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

// ── Public config endpoint — NO admin key required ─────────────
// Used by login page (maintenance check) and main app (feature flags, announcement)
export async function GET(req: NextRequest) {
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      // Return defaults — don't block the app if admin SDK not configured
      return NextResponse.json({
        maintenance: { enabled: false, message: "" },
        features: { splitView:true, imageUpload:true, history:true, quickActions:true, templates:true, skillsarkSSO:true },
        announcement: { enabled: false, title:"", message:"", type:"info" },
        aiConfig: { model:"gemini-2.0-flash", temperature:0.7, maxTokens:8192, systemPromptPrefix:"" },
      });
    }

    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    const db  = getFirestore(app);

    const [globalSnap, aiSnap, annSnap] = await Promise.all([
      db.collection("config").doc("global").get(),
      db.collection("config").doc("ai").get(),
      db.collection("config").doc("announcement").get(),
    ]);

    const global = globalSnap.exists ? globalSnap.data()! : {};
    const ai     = aiSnap.exists     ? aiSnap.data()!     : {};
    const ann    = annSnap.exists     ? annSnap.data()!    : {};

    return NextResponse.json({
      maintenance:  global.maintenance  ?? { enabled:false, message:"" },
      features:     global.features     ?? { splitView:true, imageUpload:true, history:true, quickActions:true, templates:true, skillsarkSSO:true },
      announcement: ann.enabled         ? ann : { enabled:false, title:"", message:"", type:"info" },
      aiConfig: {
        model:              ai.model              ?? "gemini-2.0-flash",
        temperature:        ai.temperature        ?? 0.7,
        maxTokens:          ai.maxTokens          ?? 8192,
        systemPromptPrefix: ai.systemPromptPrefix ?? "",
      },
    });
  } catch (e) {
    console.error("public-config error:", e);
    return NextResponse.json({
      maintenance: { enabled:false, message:"" },
      features: { splitView:true, imageUpload:true, history:true, quickActions:true, templates:true, skillsarkSSO:true },
      announcement: { enabled:false, title:"", message:"", type:"info" },
      aiConfig: { model:"gemini-2.0-flash", temperature:0.7, maxTokens:8192, systemPromptPrefix:"" },
    });
  }
}

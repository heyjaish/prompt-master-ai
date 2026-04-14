import { NextRequest, NextResponse } from "next/server";

const DEFAULTS = {
  maintenance:  { enabled: false, message: "" },
  features:     { splitView:true, imageUpload:true, history:true, quickActions:true, templates:true, skillsarkSSO:true },
  announcement: { enabled: false, title:"", message:"", type:"info" },
  aiConfig:     { model:"gemini-3-flash-preview", temperature:0.7, maxTokens:8192, systemPromptPrefix:"" },
  contact:      { email:"jaishkumar55@gmail.com", message:"Please contact admin for help.", supportUrl:"" },
};

export async function GET(_req: NextRequest) {
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) return NextResponse.json(DEFAULTS);

    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    const db  = getFirestore(app);

    const [globalSnap, aiSnap, annSnap, contactSnap] = await Promise.all([
      db.collection("config").doc("global").get(),
      db.collection("config").doc("ai").get(),
      db.collection("config").doc("announcement").get(),
      db.collection("config").doc("contact").get(),
    ]);

    const global  = globalSnap.exists  ? globalSnap.data()!  : {};
    const ai      = aiSnap.exists      ? aiSnap.data()!      : {};
    const ann     = annSnap.exists     ? annSnap.data()!     : {};
    const contact = contactSnap.exists ? contactSnap.data()! : {};

    return NextResponse.json({
      maintenance:  global.maintenance  ?? DEFAULTS.maintenance,
      features:     global.features     ?? DEFAULTS.features,
      announcement: ann.enabled ? ann : DEFAULTS.announcement,
      aiConfig: {
        model:              ai.model              ?? DEFAULTS.aiConfig.model,
        temperature:        ai.temperature        ?? DEFAULTS.aiConfig.temperature,
        maxTokens:          ai.maxTokens          ?? DEFAULTS.aiConfig.maxTokens,
        systemPromptPrefix: ai.systemPromptPrefix ?? "",
      },
      contact: {
        email:      contact.email      ?? DEFAULTS.contact.email,
        message:    contact.message    ?? DEFAULTS.contact.message,
        supportUrl: contact.supportUrl ?? "",
      },
    });
  } catch (e) {
    console.error("public-config error:", e);
    return NextResponse.json(DEFAULTS);
  }
}

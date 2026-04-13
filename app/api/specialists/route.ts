import { NextRequest, NextResponse } from "next/server";

async function getDb() {
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey)
    throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore(app);
}

// GET /api/specialists?uid=xxx — load user's 5 specialist slots
export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return NextResponse.json({ specialists: [] });
  try {
    const db   = await getDb();
    const snap = await db.collection("users").doc(uid).collection("specialists").get();
    const specialists = snap.docs.map(d => ({ slotId: d.id, ...d.data() }));
    return NextResponse.json({ specialists });
  } catch (e) {
    console.error("specialists GET error:", e);
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({ errorType: "api_error", errorMessage: String(e), severity: "Medium", userAction: "Fetch Specialists", route: "/api/specialists", uid: uid || "unknown" });
    } catch {}
    return NextResponse.json({ specialists: [] });
  }
}

// POST /api/specialists — save a specialist slot
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, slotId, name, emoji, description } = body;
    if (!uid || !slotId) return NextResponse.json({ error: "uid and slotId required" }, { status: 400 });

    const db  = await getDb();
    const systemPrompt = description
      ? `You are a specialist assistant focused on: ${description}. When engineering prompts in this domain, include highly specific technical details, proper terminology, and domain-specific requirements that make prompts immediately actionable for ${name || "this field"}.`
      : "";

    await db.collection("users").doc(uid).collection("specialists").doc(String(slotId)).set({
      slotId:       String(slotId),
      name:         name         || "",
      emoji:        emoji        || "⭐",
      description:  description  || "",
      systemPrompt,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("specialists POST error:", e);
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({ errorType: "api_error", errorMessage: String(e), severity: "Medium", userAction: "Save Specialist", route: "/api/specialists" });
    } catch {}
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

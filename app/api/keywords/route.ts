import { NextRequest, NextResponse } from "next/server";

async function getDb() {
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  const app = getApps().length ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore(app);
}

// Collection name — specialist-scoped or global
function kwCollection(uid: string, specialistId?: string | null) {
  return specialistId
    ? `users/${uid}/specialist_keywords/${specialistId}/words`
    : `users/${uid}/keywords`;
}

// GET /api/keywords?uid=xxx&specialistId=yyy — top 20 keywords
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid          = searchParams.get("uid");
  const specialistId = searchParams.get("specialistId") || null;
  if (!uid) return NextResponse.json({ keywords: [] });

  try {
    const db   = await getDb();
    const col  = kwCollection(uid, specialistId);
    const snap = await db.collection(col).orderBy("count", "desc").limit(20).get();
    const keywords = snap.docs.map(d => ({
      word:     d.id,
      count:    (d.data().count as number) || 1,
      lastSeen: (d.data().lastSeen as number) || 0,
    }));
    return NextResponse.json({ keywords });
  } catch (e) {
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({ errorType: "api_error", errorMessage: String(e), severity: "Low", userAction: "Fetch Keywords", route: "/api/keywords", uid: uid || "unknown" });
    } catch {}
    return NextResponse.json({ keywords: [] });
  }
}

// POST /api/keywords — save/increment keywords (specialist-scoped if provided)
export async function POST(req: NextRequest) {
  let uid = "unknown";
  try {
    const body: any = await req.json();
    uid = body.uid || "unknown";
    const keywords = body.keywords as string[];
    const specialistId = body.specialistId as string | undefined;
    
    if (!uid || uid === "unknown" || !keywords?.length) return NextResponse.json({ ok: true });

    const db  = await getDb();
    const col = kwCollection(uid, specialistId ?? null);

    await Promise.all(
      keywords.slice(0, 8).map(async (word) => {
        const clean = word.toLowerCase().trim();
        if (!clean || clean.length < 3) return;
        const ref  = db.collection(col).doc(clean);
        const snap = await ref.get();
        const now  = Date.now();
        if (snap.exists) {
          await ref.update({ count: (snap.data()!.count || 0) + 1, lastSeen: now });
        } else {
          await ref.set({ word: clean, count: 1, firstSeen: now, lastSeen: now });
        }
      })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({ errorType: "api_error", errorMessage: String(e), severity: "Low", userAction: "Store Keywords", route: "/api/keywords", uid: uid || "unknown" });
    } catch {}
    return NextResponse.json({ ok: true }); // never fail UI
  }
}

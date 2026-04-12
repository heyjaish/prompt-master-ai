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

// GET /api/keywords?uid=xxx — returns top 20 keywords for user
export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return NextResponse.json({ keywords: [] });
  try {
    const db   = await getDb();
    const snap = await db
      .collection("users").doc(uid).collection("keywords")
      .orderBy("count", "desc").limit(20).get();
    const keywords = snap.docs.map(d => ({ word: d.id, count: (d.data().count as number) || 1 }));
    return NextResponse.json({ keywords });
  } catch {
    return NextResponse.json({ keywords: [] });
  }
}

// POST /api/keywords — save/increment keywords for user
export async function POST(req: NextRequest) {
  try {
    const { uid, keywords } = await req.json() as { uid: string; keywords: string[] };
    if (!uid || !keywords?.length) return NextResponse.json({ ok: true });

    const db = await getDb();
    const batch = db.batch();

    await Promise.all(
      keywords.slice(0, 6).map(async (word) => {
        const clean = word.toLowerCase().trim();
        if (!clean || clean.length < 3) return;
        const ref  = db.collection("users").doc(uid).collection("keywords").doc(clean);
        const snap = await ref.get();
        if (snap.exists) {
          batch.update(ref, { count: (snap.data()!.count || 0) + 1, lastSeen: Date.now() });
        } else {
          batch.set(ref, { word: clean, count: 1, firstSeen: Date.now(), lastSeen: Date.now() });
        }
      })
    );
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never fail UI
  }
}

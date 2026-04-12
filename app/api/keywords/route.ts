import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDocs, collection, query, orderBy, limit } from "firebase/firestore";

// GET /api/keywords?uid=xxx — returns top 20 keywords for user
export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return NextResponse.json({ keywords: [] });
  try {
    if (!db) return NextResponse.json({ keywords: [] });
    const snap = await getDocs(
      query(collection(db, "users", uid, "keywords"), orderBy("count", "desc"), limit(20))
    );
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
    if (!db) return NextResponse.json({ ok: true });

    await Promise.all(
      keywords.slice(0, 6).map(async (word) => {
        const ref = doc(db!, "users", uid, "keywords", word.toLowerCase().trim());
        const snap = await import("firebase/firestore").then(m => m.getDoc(ref));
        if (snap.exists()) {
          await import("firebase/firestore").then(m => m.updateDoc(ref, { count: m.increment(1), lastSeen: Date.now() }));
        } else {
          await setDoc(ref, { word: word.toLowerCase().trim(), count: 1, firstSeen: Date.now(), lastSeen: Date.now() });
        }
      })
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never fail UI
  }
}

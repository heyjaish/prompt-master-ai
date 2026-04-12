import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, increment, updateDoc } from "firebase/firestore";

// GET /api/specialists?uid=xxx — load user's 5 specialist slots
export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  try {
    if (!db) return NextResponse.json({ specialists: [] });
    const snap = await getDocs(collection(db, "users", uid, "specialists"));
    const specialists = snap.docs.map(d => ({ slotId: d.id, ...d.data() }));
    return NextResponse.json({ specialists });
  } catch (e) {
    return NextResponse.json({ specialists: [] });
  }
}

// POST /api/specialists — save a specialist slot
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, slotId, name, emoji, description } = body;
    if (!uid || !slotId) return NextResponse.json({ error: "uid and slotId required" }, { status: 400 });
    if (!db) return NextResponse.json({ error: "DB not initialized" }, { status: 500 });

    // Auto-generate a concise system prompt from user's description
    const systemPrompt = description
      ? `You are a specialist assistant focused on: ${description}. When engineering prompts in this domain, include highly specific technical details, proper terminology, and domain-specific requirements that make prompts immediately actionable for ${name || "this field"}.`
      : "";

    const ref = doc(db, "users", uid, "specialists", String(slotId));
    await setDoc(ref, {
      slotId: String(slotId),
      name:   name || "",
      emoji:  emoji || "⭐",
      description: description || "",
      systemPrompt,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "admin-secret-2025";

// POST /api/analytics — track an event (silent, always returns 200)
export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const { uid, event, metadata, timestamp, sessionId } = body;
    if (!uid || !event) return NextResponse.json({ ok: true });

    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const pk          = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !pk) return NextResponse.json({ ok: true });

    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk }) });
    const db  = getFirestore(app);

    // Store event in analytics collection
    const ref = db.collection("analytics").doc();
    await ref.set({ uid, event, metadata: metadata || {}, timestamp: timestamp || Date.now(), sessionId: sessionId || "" });

    // Also increment feature counter in summary doc
    await db.collection("analytics").doc("summary").set(
      { [event]: (await db.collection("analytics").doc("summary").get().then(s => (s.data()?.[event] || 0))) + 1, updatedAt: Date.now() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({ errorType: "api_error", errorMessage: String(e), severity: "Low", userAction: "Track Event", route: "/api/analytics" });
    } catch {}
    return NextResponse.json({ ok: true }); // always 200
  }
}

// GET /api/analytics — admin fetches aggregated event data
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== ADMIN_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const pk          = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !pk) return NextResponse.json({ summary: {}, recent: [] });

    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk }) });
    const db  = getFirestore(app);

    const [summarySnap, recentSnap] = await Promise.all([
      db.collection("analytics").doc("summary").get(),
      db.collection("analytics").where("timestamp", ">", Date.now() - 7*24*60*60*1000).limit(200).get(),
    ]);

    const summary = summarySnap.exists ? summarySnap.data() : {};
    const recent  = recentSnap.docs.map(d => d.data()).filter(d => d.event !== undefined);

    // Aggregate by event type
    const byEvent: Record<string, number> = {};
    recent.forEach(e => { byEvent[e.event] = (byEvent[e.event] || 0) + 1; });

    // Hourly distribution (last 7 days)
    const byHour: Record<number, number> = {};
    recent.forEach(e => {
      const h = new Date(e.timestamp).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });

    // Unique users last 7 days
    const uniqueUsers = new Set(recent.map(e => e.uid)).size;

    return NextResponse.json({ summary, byEvent, byHour, uniqueUsers, eventCount: recent.length });
  } catch (e) {
    try {
      const { logServerError } = await import("@/lib/server-logger");
      await logServerError({ errorType: "api_error", errorMessage: String(e), severity: "Medium", userAction: "Fetch Analytics", route: "/api/analytics" });
    } catch {}
    return NextResponse.json({ summary: {}, byEvent: {}, byHour: {}, uniqueUsers: 0, eventCount: 0 });
  }
}

import { NextRequest, NextResponse } from "next/server";

// ── Firebase Admin (server-side, bypasses ALL Firestore rules) ──
let adminDb: FirebaseFirestore.Firestore | null = null;

async function getAdminDb() {
  if (adminDb) return adminDb;
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  }
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  adminDb = getFirestore(app);
  return adminDb;
}

// ── Admin auth guard — only allow hardcoded admin emails ────────
const ADMIN_EMAILS = ["jaishkumar55@gmail.com"];

function checkAdminHeader(req: NextRequest): boolean {
  const adminKey = req.headers.get("x-admin-key");
  return adminKey === process.env.ADMIN_SECRET_KEY;
}

// ── GET: fetch users or config ───────────────────────────────────
export async function GET(req: NextRequest) {
  if (!checkAdminHeader(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const db = await getAdminDb();

    if (action === "users") {
      const snap = await db.collection("users").orderBy("lastActiveAt", "desc").limit(500).get();
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      return NextResponse.json({ users });
    }

    if (action === "config") {
      const snap = await db.collection("config").doc("global").get();
      return NextResponse.json({ config: snap.exists ? snap.data() : null });
    }

    if (action === "stats") {
      const [usersSnap, cfgSnap] = await Promise.all([
        db.collection("users").get(),
        db.collection("config").doc("global").get(),
      ]);
      const users = usersSnap.docs.map(d => d.data());
      const today = new Date().toISOString().slice(0, 10);
      return NextResponse.json({
        totalUsers:   users.length,
        activeUsers:  users.filter((u: Record<string, unknown>) => u.status === "active").length,
        totalPrompts: users.reduce((s: number, u: Record<string, unknown>) => s + ((u.totalPrompts as number) || 0), 0),
        todayPrompts: users.filter((u: Record<string, unknown>) => u.dailyDate === today).reduce((s: number, u: Record<string, unknown>) => s + ((u.dailyPrompts as number) || 0), 0),
        config:       cfgSnap.exists ? cfgSnap.data() : null,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "FIREBASE_ADMIN_NOT_CONFIGURED") {
      return NextResponse.json({ error: "FIREBASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: update user or config ──────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAdminHeader(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body   = await req.json();
    const db     = await getAdminDb();
    const action = body.action;

    if (action === "updateUser" && body.uid && body.data) {
      await db.collection("users").doc(body.uid).update({ ...body.data, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "saveConfig" && body.config) {
      await db.collection("config").doc("global").set({ ...body.config, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "resetDailyAll") {
      const snap  = await db.collection("users").get();
      const today = new Date().toISOString().slice(0, 10);
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { dailyPrompts: 0, dailyDate: today }));
      await batch.commit();
      return NextResponse.json({ ok: true, count: snap.size });
    }

    if (action === "registerUser" && body.user) {
      const { uid, email, name, photoURL, provider } = body.user;
      const ref  = db.collection("users").doc(uid);
      const snap = await ref.get();
      if (!snap.exists) {
        const now = Date.now();
        await ref.set({ uid, email, name, photoURL, provider, role: "user", status: "active", plan: "free", totalPrompts: 0, dailyPrompts: 0, dailyDate: new Date().toISOString().slice(0, 10), createdAt: now, lastActiveAt: now, note: "" });
      } else {
        await ref.update({ name, photoURL, lastActiveAt: Date.now() });
      }
      const userData = (await ref.get()).data();
      return NextResponse.json({ ok: true, user: userData });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "FIREBASE_ADMIN_NOT_CONFIGURED") {
      return NextResponse.json({ error: "FIREBASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

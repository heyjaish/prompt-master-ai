import { NextRequest, NextResponse } from "next/server";
import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

async function getAdminDb(): Promise<Firestore> {
  if (_db) return _db;
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  _db = getFirestore(_app);
  return _db;
}

function auth(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_SECRET_KEY;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const action = new URL(req.url).searchParams.get("action");
  try {
    const db = await getAdminDb();

    if (action === "users") {
      const snap = await db.collection("users").orderBy("lastActiveAt", "desc").limit(500).get();
      return NextResponse.json({ users: snap.docs.map(d => ({ uid: d.id, ...d.data() })) });
    }

    if (action === "config") {
      const snap = await db.collection("config").doc("global").get();
      return NextResponse.json({ config: snap.exists ? snap.data() : null });
    }

    if (action === "aiConfig") {
      const snap = await db.collection("config").doc("ai").get();
      return NextResponse.json({ aiConfig: snap.exists ? snap.data() : null });
    }

    if (action === "announcement") {
      const snap = await db.collection("config").doc("announcement").get();
      return NextResponse.json({ announcement: snap.exists ? snap.data() : null });
    }

    if (action === "analytics") {
      const usersSnap = await db.collection("users").get();
      const users = usersSnap.docs.map(d => d.data());
      const today = new Date().toISOString().slice(0, 10);
      // Build last 7 days stats from users dailyDate/dailyPrompts
      const days: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      users.forEach((u: Record<string, unknown>) => {
        if (u.dailyDate && days[u.dailyDate as string] !== undefined) {
          days[u.dailyDate as string] += (u.dailyPrompts as number) || 0;
        }
      });
      const topUsers = [...users]
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.totalPrompts as number) || 0) - ((a.totalPrompts as number) || 0))
        .slice(0, 10)
        .map((u: Record<string, unknown>) => ({ name: u.name, email: u.email, totalPrompts: u.totalPrompts, plan: u.plan, photoURL: u.photoURL }));
      return NextResponse.json({
        totalUsers:   users.length,
        activeUsers:  users.filter((u: Record<string, unknown>) => u.status === "active").length,
        bannedUsers:  users.filter((u: Record<string, unknown>) => u.status === "banned").length,
        totalPrompts: users.reduce((s: number, u: Record<string, unknown>) => s + ((u.totalPrompts as number) || 0), 0),
        todayPrompts: users.filter((u: Record<string, unknown>) => u.dailyDate === today).reduce((s: number, u: Record<string, unknown>) => s + ((u.dailyPrompts as number) || 0), 0),
        planDist: {
          free:      users.filter((u: Record<string, unknown>) => u.plan === "free").length,
          pro:       users.filter((u: Record<string, unknown>) => u.plan === "pro").length,
          unlimited: users.filter((u: Record<string, unknown>) => u.plan === "unlimited").length,
        },
        providerDist: {
          google:    users.filter((u: Record<string, unknown>) => (u.provider as string)?.includes("google")).length,
          skillsark: users.filter((u: Record<string, unknown>) => u.provider === "skillsark").length,
        },
        dailyChart: days,
        topUsers,
      });
    }

    if (action === "exportCSV") {
      const snap = await db.collection("users").get();
      const rows = snap.docs.map(d => {
        const u = d.data();
        return [u.name, u.email, u.plan, u.status, u.role, u.totalPrompts, u.dailyPrompts, u.provider, new Date(u.createdAt || 0).toLocaleDateString()].join(",");
      });
      const csv = ["Name,Email,Plan,Status,Role,TotalPrompts,DailyPrompts,Provider,Joined", ...rows].join("\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=users.csv" } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "FIREBASE_ADMIN_NOT_CONFIGURED" ? 503 : 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body   = await req.json();
    const db     = await getAdminDb();
    const action = body.action as string;

    if (action === "registerUser" && body.user) {
      const { uid, email, name, photoURL, provider } = body.user;
      const ref  = db.collection("users").doc(uid);
      const snap = await ref.get();
      if (!snap.exists) {
        const now = Date.now();
        await ref.set({ uid, email, name, photoURL, provider, role: "user", status: "active", plan: "free", totalPrompts: 0, dailyPrompts: 0, dailyDate: new Date().toISOString().slice(0, 10), createdAt: now, lastActiveAt: now, note: "", customDailyLimit: null });
        return NextResponse.json({ ok: true, isNew: true });
      } else {
        const data = snap.data()!;
        if (data.status === "banned")    return NextResponse.json({ ok: false, blocked: true, reason: "banned" });
        if (data.status === "suspended") return NextResponse.json({ ok: false, blocked: true, reason: "suspended" });
        await ref.update({ name, photoURL, lastActiveAt: Date.now() });
        return NextResponse.json({ ok: true, user: data });
      }
    }

    if (action === "updateUser" && body.uid) {
      await db.collection("users").doc(body.uid).update({ ...body.data, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "saveConfig" && body.config) {
      await db.collection("config").doc("global").set({ ...body.config, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "saveAIConfig" && body.aiConfig) {
      await db.collection("config").doc("ai").set({ ...body.aiConfig, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "saveAnnouncement" && body.announcement) {
      await db.collection("config").doc("announcement").set({ ...body.announcement, updatedAt: Date.now() });
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

    if (action === "deleteUser" && body.uid) {
      await db.collection("users").doc(body.uid).delete();
      return NextResponse.json({ ok: true });
    }

    if (action === "bulkUpdatePlan" && body.uids && body.plan) {
      const batch = db.batch();
      (body.uids as string[]).forEach(uid => batch.update(db.collection("users").doc(uid), { plan: body.plan }));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (action === "bulkUpdateStatus" && body.uids && body.status) {
      const batch = db.batch();
      (body.uids as string[]).forEach(uid => batch.update(db.collection("users").doc(uid), { status: body.status }));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (action === "checkPrompt" && body.uid) {
      const ref  = db.collection("users").doc(body.uid);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ allowed: true, remaining: 99 });
      const u    = snap.data()!;
      const cfg  = await db.collection("config").doc("global").get();
      const limits = cfg.exists ? (cfg.data()!.limits || { free:10, pro:100, unlimited:-1 }) : { free:10, pro:100, unlimited:-1 };
      if (u.status !== "active") return NextResponse.json({ allowed: false, remaining: 0, reason: "Account suspended/banned." });
      const dailyLimit = u.customDailyLimit ?? limits[u.plan as string] ?? limits.free;
      if (dailyLimit === -1) {
        await ref.update({ totalPrompts: (u.totalPrompts||0)+1, lastActiveAt: Date.now() });
        return NextResponse.json({ allowed: true, remaining: -1 });
      }
      const today = new Date().toISOString().slice(0, 10);
      const daily = u.dailyDate === today ? (u.dailyPrompts || 0) : 0;
      if (daily >= dailyLimit) return NextResponse.json({ allowed: false, remaining: 0, reason: `Daily limit of ${dailyLimit} reached.` });
      await ref.update({ dailyPrompts: daily+1, dailyDate: today, totalPrompts: (u.totalPrompts||0)+1, lastActiveAt: Date.now() });
      return NextResponse.json({ allowed: true, remaining: dailyLimit - (daily+1) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "FIREBASE_ADMIN_NOT_CONFIGURED" ? 503 : 500 });
  }
}

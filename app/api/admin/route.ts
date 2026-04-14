import { NextRequest, NextResponse } from "next/server";
import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

// ── Protected admin emails — CANNOT be banned/suspended/deleted ─
const PROTECTED_EMAILS = ["jaishkumar55@gmail.com"];

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

function authOk(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_SECRET_KEY;
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const action = new URL(req.url).searchParams.get("action");
  try {
    const db = await getAdminDb();

    if (action === "users") {
      const snap = await db.collection("users").orderBy("lastActiveAt", "desc").limit(500).get();
      return NextResponse.json({ users: snap.docs.map(d => ({ uid: d.id, ...d.data() })) });
    }

    if (action === "config") {
      const [global, contact] = await Promise.all([
        db.collection("config").doc("global").get(),
        db.collection("config").doc("contact").get(),
      ]);
      return NextResponse.json({
        config:  global.exists  ? global.data()  : null,
        contact: contact.exists ? contact.data() : null,
      });
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
      const days: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      users.forEach((u: Record<string, unknown>) => {
        if (u.dailyDate && days[u.dailyDate as string] !== undefined)
          days[u.dailyDate as string] += (u.dailyPrompts as number) || 0;
      });
      const topUsers = [...users]
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.totalPrompts as number) || 0) - ((a.totalPrompts as number) || 0))
        .slice(0, 10)
        .map((u: Record<string, unknown>) => ({ name: u.name, email: u.email, totalPrompts: u.totalPrompts, plan: u.plan, photoURL: u.photoURL, tags: u.tags }));
      // New users this week
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const newThisWeek = users.filter((u: Record<string, unknown>) => (u.createdAt as number) > weekAgo).length;
      // Avg prompts per user
      const avgPrompts = users.length ? Math.round(users.reduce((s: number, u: Record<string, unknown>) => s + ((u.totalPrompts as number) || 0), 0) / users.length) : 0;
      return NextResponse.json({
        totalUsers:   users.length,
        activeUsers:  users.filter((u: Record<string, unknown>) => u.status === "active").length,
        bannedUsers:  users.filter((u: Record<string, unknown>) => u.status === "banned").length,
        suspendedUsers: users.filter((u: Record<string, unknown>) => u.status === "suspended").length,
        newThisWeek,
        avgPrompts,
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

    if (action === "errors") {
      const snap = await db.collection("errors")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();
      const errors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ errors });
    }

    if (action === "userHistory") {
      const uid = new URL(req.url).searchParams.get("uid");
      if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
      const [hSnap, pSnap] = await Promise.all([
        db.collection("users").doc(uid).collection("history").orderBy("timestamp", "desc").limit(100).get(),
        db.collection("users").doc(uid).collection("prompts").orderBy("timestamp", "desc").limit(100).get()
      ]);
      const merged = [...hSnap.docs.map(d=>({id:d.id, ...d.data()})), ...pSnap.docs.map(d=>({id:d.id, ...d.data()}))]
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 100);
      return NextResponse.json({ history: merged });
    }

    if (action === "exportCSV") {
      const snap = await db.collection("users").get();
      const rows = snap.docs.map(d => {
        const u = d.data();
        return [u.name, u.email, u.plan, u.status, u.role, u.totalPrompts, u.dailyPrompts, u.provider, (u.tags||[]).join("|"), new Date(u.createdAt || 0).toLocaleDateString()].join(",");
      });
      const csv = ["Name,Email,Plan,Status,Role,TotalPrompts,DailyPrompts,Provider,Tags,Joined", ...rows].join("\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=users.csv" } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "FIREBASE_ADMIN_NOT_CONFIGURED" ? 503 : 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        await ref.set({ uid, email, name, photoURL, provider, role: "user", status: "active", plan: "free", totalPrompts: 0, dailyPrompts: 0, dailyDate: new Date().toISOString().slice(0, 10), createdAt: now, lastActiveAt: now, note: "", customDailyLimit: null, tags: [] });
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
      // ── Protect admin email from being banned/suspended/deleted ──
      if (body.data?.status && body.data.status !== "active") {
        const userSnap = await db.collection("users").doc(body.uid).get();
        if (userSnap.exists) {
          const email = userSnap.data()!.email as string;
          if (PROTECTED_EMAILS.includes(email)) {
            return NextResponse.json({ error: `🛡️ Cannot change status of protected admin account (${email})` }, { status: 403 });
          }
        }
      }
      await db.collection("users").doc(body.uid).update({ ...body.data, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "logError") {
      // Log any error from any user — fire-and-forget from engineer route or frontend
      const { uid, email, errorType, errorMessage, specialist, modelUsed, url, severity, stack, route, userAction } = body;
      const ref = db.collection("errors").doc();
      await ref.set({
        uid:          uid          ?? "anonymous",
        email:        email        ?? "unknown",
        errorType:    errorType    ?? "unknown",
        errorMessage: (errorMessage ?? "").slice(0, 1000),
        severity:     severity     ?? "Medium",
        stack:        (stack ?? "").slice(0, 2000),
        route:        route        ?? url ?? null,
        userAction:   userAction   ?? null,
        specialist:   specialist   ?? null,
        modelUsed:    modelUsed    ?? null,
        timestamp:    Date.now(),
        resolved:     false,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "resolveError" && body.errorId) {
      await db.collection("errors").doc(body.errorId).update({ resolved: true, resolvedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "bulkResolveErrors" && body.errorIds) {
      const batch = db.batch();
      (body.errorIds as string[]).forEach(id => batch.update(db.collection("errors").doc(id), { resolved: true, resolvedAt: Date.now() }));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (action === "deleteError" && body.errorId) {
      await db.collection("errors").doc(body.errorId).delete();
      return NextResponse.json({ ok: true });
    }

    if (action === "bulkDeleteErrors" && body.errorIds) {
      const batch = db.batch();
      (body.errorIds as string[]).forEach(id => batch.delete(db.collection("errors").doc(id)));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (action === "saveConfig" && body.config) {
      await db.collection("config").doc("global").set({ ...body.config, updatedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }

    if (action === "saveContact" && body.contact) {
      await db.collection("config").doc("contact").set({ ...body.contact, updatedAt: Date.now() });
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
      // Protect admin email from deletion too
      const userSnap = await db.collection("users").doc(body.uid).get();
      if (userSnap.exists && PROTECTED_EMAILS.includes(userSnap.data()!.email)) {
        return NextResponse.json({ error: "🛡️ Cannot delete protected admin account." }, { status: 403 });
      }
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
      // Filter out protected emails from bulk ban
      const protectedSnaps = await Promise.all(
        (body.uids as string[]).map(uid => db.collection("users").doc(uid).get())
      );
      const safeUids = (body.uids as string[]).filter((uid, i) => {
        const email = protectedSnaps[i].data()?.email as string;
        return !PROTECTED_EMAILS.includes(email);
      });
      if (safeUids.length === 0) return NextResponse.json({ error: "🛡️ All selected users are protected admins." }, { status: 403 });
      const batch = db.batch();
      safeUids.forEach(uid => batch.update(db.collection("users").doc(uid), { status: body.status }));
      await batch.commit();
      return NextResponse.json({ ok: true, skipped: (body.uids as string[]).length - safeUids.length });
    }

    if (action === "checkPrompt" && body.uid) {
      const ref  = db.collection("users").doc(body.uid);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ allowed: true, remaining: 99 });
      const u   = snap.data()!;
      const cfg = await db.collection("config").doc("global").get();
      const limits = cfg.exists ? (cfg.data()!.limits || { free:10, pro:100, unlimited:-1 }) : { free:10, pro:100, unlimited:-1 };
      if (u.status !== "active") return NextResponse.json({ allowed: false, remaining: 0, reason: "Account suspended/banned." });
      const dailyLimit = u.customDailyLimit ?? limits[u.plan as string] ?? limits.free;
      if (dailyLimit === -1) {
        await ref.update({ totalPrompts: (u.totalPrompts||0)+1, lastActiveAt: Date.now() });
        return NextResponse.json({ allowed: true, remaining: -1 });
      }
      const today = new Date().toISOString().slice(0, 10);
      const daily = u.dailyDate === today ? (u.dailyPrompts || 0) : 0;
      if (daily >= dailyLimit) return NextResponse.json({ allowed: false, remaining: 0, reason: `Daily limit of ${dailyLimit} prompts reached. Upgrade your plan for more.` });
      await ref.update({ dailyPrompts: daily+1, dailyDate: today, totalPrompts: (u.totalPrompts||0)+1, lastActiveAt: Date.now() });
      return NextResponse.json({ allowed: true, remaining: dailyLimit - (daily+1) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "FIREBASE_ADMIN_NOT_CONFIGURED" ? 503 : 500 });
  }
}

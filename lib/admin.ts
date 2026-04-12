import {
  doc, getDoc, setDoc, collection, getDocs,
  query, orderBy, limit, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Types ─────────────────────────────────────────────────────
export interface FeatureFlags {
  splitView:    boolean;
  imageUpload:  boolean;
  history:      boolean;
  quickActions: boolean;
  templates:    boolean;
  skillsarkSSO: boolean;
}

export interface UsageLimits { free: number; pro: number; unlimited: number; }
export interface MaintenanceConfig { enabled: boolean; message: string; }

export interface AdminConfig {
  features:    FeatureFlags;
  limits:      UsageLimits;
  maintenance: MaintenanceConfig;
  updatedAt:   number;
}

export type UserStatus = "active" | "suspended" | "banned";
export type UserPlan   = "free" | "pro" | "unlimited";
export type UserRole   = "user" | "admin";

export interface UserRecord {
  uid:          string;
  email:        string;
  name:         string;
  photoURL:     string;
  provider:     string;
  role:         UserRole;
  status:       UserStatus;
  plan:         UserPlan;
  totalPrompts: number;
  dailyPrompts: number;
  dailyDate:    string;
  createdAt:    number;
  lastActiveAt: number;
  note:         string;
}

// ── Default config ─────────────────────────────────────────────
export const DEFAULT_CONFIG: AdminConfig = {
  features: {
    splitView: true, imageUpload: true, history: true,
    quickActions: true, templates: true, skillsarkSSO: true,
  },
  limits:      { free: 10, pro: 100, unlimited: -1 },
  maintenance: { enabled: false, message: "We'll be right back soon!" },
  updatedAt:   0,
};

// ── Firestore refs ─────────────────────────────────────────────
// NOTE: db can be null during SSR/build — always guard before use
const getDb     = () => { if (!db) throw new Error("Firestore not initialized (check NEXT_PUBLIC_FIREBASE_* env vars)"); return db; };
const cfgRef    = () => doc(getDb(), "config", "global");
const usersRef  = () => collection(getDb(), "users");
const userRef   = (uid: string) => doc(getDb(), "users", uid);

// ── Config CRUD ────────────────────────────────────────────────
export async function getAdminConfig(): Promise<AdminConfig> {
  try {
    const snap = await getDoc(cfgRef());
    if (!snap.exists()) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...snap.data() } as AdminConfig;
  } catch (e) {
    console.warn("getAdminConfig failed:", e);
    return DEFAULT_CONFIG;
  }
}

export async function saveAdminConfig(cfg: AdminConfig): Promise<void> {
  await setDoc(cfgRef(), { ...cfg, updatedAt: Date.now() });
}

// ── User CRUD — throws so admin can display the error ──────────
export async function getAllUsers(): Promise<UserRecord[]> {
  // This INTENTIONALLY throws so the admin panel can show the real error
  const snap = await getDocs(query(usersRef(), orderBy("lastActiveAt", "desc"), limit(500)));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }) as UserRecord);
}

export async function updateUserRecord(uid: string, data: Partial<UserRecord>): Promise<void> {
  await updateDoc(userRef(uid), data as Record<string, unknown>);
}

// ── Register / update user on login ───────────────────────────
export async function registerUser(user: {
  uid: string; email: string; name: string;
  photoURL: string; provider: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ref  = userRef(user.uid);
    const [snap, cfgSnap] = await Promise.all([
      getDoc(ref),
      getDoc(cfgRef()).catch(() => null),
    ]);

    const cfg = (cfgSnap?.exists()
      ? { ...DEFAULT_CONFIG, ...cfgSnap.data() }
      : DEFAULT_CONFIG) as AdminConfig;

    if (cfg.maintenance.enabled) {
      return { allowed: false, reason: cfg.maintenance.message };
    }

    const now = Date.now();
    if (!snap.exists()) {
      await setDoc(ref, {
        uid:          user.uid,
        email:        user.email,
        name:         user.name,
        photoURL:     user.photoURL,
        provider:     user.provider,
        role:         "user",
        status:       "active",
        plan:         "free",
        totalPrompts: 0,
        dailyPrompts: 0,
        dailyDate:    new Date().toISOString().slice(0, 10),
        createdAt:    now,
        lastActiveAt: now,
        note:         "",
      });
      console.log("[Admin] New user registered:", user.email);
    } else {
      const existing = snap.data() as UserRecord;
      if (existing.status === "banned")     return { allowed: false, reason: "Your account has been banned." };
      if (existing.status === "suspended")  return { allowed: false, reason: "Your account is suspended." };
      await updateDoc(ref, {
        lastActiveAt: now,
        name:         user.name,
        photoURL:     user.photoURL,
      });
    }
    return { allowed: true };
  } catch (e) {
    console.error("[Admin] registerUser error:", e);
    return { allowed: true }; // Don't block login on Firestore write failure
  }
}

// ── Check & increment usage ────────────────────────────────────
export async function checkAndIncrementPrompt(uid: string): Promise<{
  allowed: boolean; remaining: number; reason?: string;
}> {
  try {
    const [snap, cfgSnap] = await Promise.all([
      getDoc(userRef(uid)),
      getDoc(cfgRef()).catch(() => null),
    ]);
    const cfg  = (cfgSnap?.exists()
      ? { ...DEFAULT_CONFIG, ...cfgSnap.data() }
      : DEFAULT_CONFIG) as AdminConfig;
    const user = snap.exists() ? (snap.data() as UserRecord) : null;

    if (!user) return { allowed: true, remaining: 99 };
    if (user.status !== "active") {
      return { allowed: false, remaining: 0, reason: "Account suspended or banned." };
    }

    const dailyLimit = cfg.limits[user.plan as UserPlan] ?? cfg.limits.free;
    if (dailyLimit === -1) {
      await updateDoc(userRef(uid), { totalPrompts: (user.totalPrompts ?? 0) + 1, lastActiveAt: Date.now() });
      return { allowed: true, remaining: -1 };
    }

    const today = new Date().toISOString().slice(0, 10);
    const daily = user.dailyDate === today ? (user.dailyPrompts ?? 0) : 0;
    if (daily >= dailyLimit) {
      return { allowed: false, remaining: 0, reason: `Daily limit of ${dailyLimit} prompts reached.` };
    }

    await updateDoc(userRef(uid), {
      dailyPrompts: daily + 1,
      dailyDate:    today,
      totalPrompts: (user.totalPrompts ?? 0) + 1,
      lastActiveAt: Date.now(),
    });
    return { allowed: true, remaining: dailyLimit - (daily + 1) };
  } catch {
    return { allowed: true, remaining: 99 };
  }
}

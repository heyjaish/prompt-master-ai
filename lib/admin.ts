import {
  doc, getDoc, setDoc, collection, getDocs,
  query, orderBy, limit, updateDoc, where,
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
const cfgDoc  = () => db && doc(db, "config", "global");
const usersCol = () => db && collection(db, "users");
const userDoc = (uid: string) => db && doc(db, "users", uid);

// ── Config CRUD ────────────────────────────────────────────────
export async function getAdminConfig(): Promise<AdminConfig> {
  try {
    const ref = cfgDoc(); if (!ref) return DEFAULT_CONFIG;
    const snap = await getDoc(ref);
    if (!snap.exists()) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...snap.data() } as AdminConfig;
  } catch { return DEFAULT_CONFIG; }
}

export async function saveAdminConfig(cfg: AdminConfig): Promise<void> {
  const ref = cfgDoc(); if (!ref) return;
  await setDoc(ref, { ...cfg, updatedAt: Date.now() });
}

// ── User CRUD ──────────────────────────────────────────────────
export async function getAllUsers(): Promise<UserRecord[]> {
  try {
    const col = usersCol(); if (!col) return [];
    const snap = await getDocs(query(col, orderBy("lastActiveAt", "desc"), limit(500)));
    return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserRecord);
  } catch { return []; }
}

export async function updateUserRecord(uid: string, data: Partial<UserRecord>): Promise<void> {
  const ref = userDoc(uid); if (!ref) return;
  await updateDoc(ref, data as Record<string, unknown>);
}

// ── Register / update user profile on login ────────────────────
export async function registerUser(user: {
  uid: string; email: string; name: string;
  photoURL: string; provider: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ref = userDoc(user.uid); if (!ref) return { allowed: true };
    const [snap, cfgSnap] = await Promise.all([
      getDoc(ref),
      cfgDoc() ? getDoc(cfgDoc()!) : Promise.resolve(null),
    ]);
    const cfg = (cfgSnap?.exists() ? { ...DEFAULT_CONFIG, ...cfgSnap.data() } : DEFAULT_CONFIG) as AdminConfig;

    // Check maintenance
    if (cfg.maintenance.enabled) return { allowed: false, reason: cfg.maintenance.message };

    const now = Date.now();
    if (!snap.exists()) {
      await setDoc(ref, {
        ...user, role: "user", status: "active", plan: "free",
        totalPrompts: 0, dailyPrompts: 0,
        dailyDate: new Date().toISOString().slice(0, 10),
        createdAt: now, lastActiveAt: now, note: "",
      });
    } else {
      const existing = snap.data() as UserRecord;
      if (existing.status === "banned") return { allowed: false, reason: "Your account has been banned." };
      if (existing.status === "suspended") return { allowed: false, reason: "Your account is suspended." };
      await updateDoc(ref, { lastActiveAt: now, name: user.name, photoURL: user.photoURL });
    }
    return { allowed: true };
  } catch { return { allowed: true }; }
}

// ── Check & increment prompt usage ────────────────────────────
export async function checkAndIncrementPrompt(uid: string): Promise<{
  allowed: boolean; remaining: number; reason?: string;
}> {
  try {
    const ref = userDoc(uid); if (!ref) return { allowed: true, remaining: 999 };
    const [snap, cfgSnap] = await Promise.all([
      getDoc(ref),
      cfgDoc() ? getDoc(cfgDoc()!) : Promise.resolve(null),
    ]);
    const cfg  = (cfgSnap?.exists() ? { ...DEFAULT_CONFIG, ...cfgSnap.data() } : DEFAULT_CONFIG) as AdminConfig;
    const user = snap.exists() ? (snap.data() as UserRecord) : null;

    if (!user) return { allowed: true, remaining: 99 };
    if (user.status !== "active") return { allowed: false, remaining: 0, reason: "Account suspended or banned." };

    const dailyLimit = cfg.limits[user.plan as UserPlan] ?? cfg.limits.free;
    if (dailyLimit === -1) {
      await updateDoc(ref, { totalPrompts: (user.totalPrompts??0)+1, lastActiveAt: Date.now() });
      return { allowed: true, remaining: -1 };
    }

    const today = new Date().toISOString().slice(0, 10);
    const daily = user.dailyDate === today ? (user.dailyPrompts ?? 0) : 0;
    if (daily >= dailyLimit) {
      return { allowed: false, remaining: 0, reason: `Daily limit of ${dailyLimit} prompts reached. Upgrade your plan for more.` };
    }

    await updateDoc(ref, {
      dailyPrompts: daily + 1, dailyDate: today,
      totalPrompts: (user.totalPrompts??0)+1, lastActiveAt: Date.now(),
    });
    return { allowed: true, remaining: dailyLimit - (daily + 1) };
  } catch { return { allowed: true, remaining: 99 }; }
}

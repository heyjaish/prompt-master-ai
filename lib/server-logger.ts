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
  
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  }

  const apps = getApps();
  _app = apps.length ? apps[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  _db = getFirestore(_app);
  return _db;
}

export async function logServerError(args: {
  uid?: string;
  email?: string;
  errorType: string;
  errorMessage: string;
  severity?: "Low" | "Medium" | "High" | "Critical";
  stack?: string | null;
  userAction?: string;
  route?: string;
  specialist?: string | null;
  modelUsed?: string | null;
}) {
  try {
    const db = await getAdminDb();
    await db.collection("errors").doc().set({
      uid:          args.uid          ?? "anonymous",
      email:        args.email        ?? "unknown",
      errorType:    args.errorType    ?? "unknown",
      errorMessage: (args.errorMessage ?? "").slice(0, 2000),
      severity:     args.severity     ?? "Medium",
      stack:        (args.stack        ?? "").slice(0, 5000),
      route:        args.route        ?? null,
      userAction:   args.userAction   ?? "Server Action",
      specialist:   args.specialist   ?? null,
      modelUsed:    args.modelUsed    ?? null,
      timestamp:    Date.now(),
      resolved:     false,
    });
  } catch (e) {
    console.error("[Logger] Failed to log server error:", e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// ── Firebase Admin singleton ───────────────────────────────────
function getAdminApp(): App | null {
  try {
    if (getApps().length > 0) return getApps()[0];
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
      console.warn("Firebase Admin not configured — custom tokens unavailable");
      return null;
    }
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } catch (e) {
    console.error("Firebase Admin init error:", e);
    return null;
  }
}

const SKILLSARK_EXCHANGE_URL =
  (process.env.NEXT_PUBLIC_SKILLSARK_PORTAL_URL ?? "https://portal.skillsark.in") +
  "/api/sso_exchange.php";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing sso_code" }, { status: 400 });
    }

    // ── Step 1: exchange code with Skillsark ─────────────────
    // Try form-encoded first (most compatible with PHP endpoints)
    const formBody = new URLSearchParams({ code }).toString();

    const skRes = await fetch(SKILLSARK_EXCHANGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: formBody,
    });

    const rawText = await skRes.text();
    console.log("[SSO Exchange] Status:", skRes.status, "| Body:", rawText.slice(0, 300));

    // Parse response (may be JSON or HTML error)
    let skData: { success?: boolean; message?: string; user?: Record<string, unknown> } = {};
    try {
      skData = JSON.parse(rawText);
    } catch {
      // Skillsark returned non-JSON (e.g. HTML error page)
      return NextResponse.json(
        { error: `Skillsark returned unexpected response (HTTP ${skRes.status}): ${rawText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    if (!skData.success || !skData.user) {
      return NextResponse.json(
        { error: skData.message ?? "Skillsark SSO exchange failed" },
        { status: 401 }
      );
    }

    const user = skData.user as {
      id: number; name: string; email: string; role: string;
    };

    // ── Step 2: create Firebase custom token ─────────────────
    const adminApp = getAdminApp();
    if (!adminApp) {
      // Admin SDK not configured — return user data only, client will handle
      return NextResponse.json({
        customToken: null,
        noAdmin: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    }

    const uid = `skillsark_${user.id}`;
    const customToken = await getAuth(adminApp).createCustomToken(uid, {
      provider:     "skillsark",
      skillsark_id: user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
    });

    return NextResponse.json({
      customToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error("[SSO Exchange] Internal error:", err);
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}

// Explicitly return 405 for non-POST (replaces Next.js default)
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}

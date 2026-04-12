import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// ── Firebase Admin singleton ───────────────────
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Vercel stores private keys with literal \n — convert to real newlines
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
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

    // ── Step 1: exchange code with Skillsark portal ──
    const skRes = await fetch(SKILLSARK_EXCHANGE_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code }),
    });

    const skData = await skRes.json();
    if (!skData.success) {
      return NextResponse.json(
        { error: skData.message ?? "Skillsark SSO exchange failed" },
        { status: 401 }
      );
    }

    const { user } = skData;

    // ── Step 2: create Firebase custom token ──────────
    // UID prefix keeps Skillsark users separate from Google users
    const uid = `skillsark_${user.id}`;
    const adminAuth = getAuth(getAdminApp());

    const customToken = await adminAuth.createCustomToken(uid, {
      provider:     "skillsark",
      skillsark_id: user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
    });

    return NextResponse.json({
      customToken,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    });
  } catch (err) {
    console.error("SSO exchange error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

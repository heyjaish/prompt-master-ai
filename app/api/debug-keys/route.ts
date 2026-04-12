import { NextRequest, NextResponse } from "next/server";

// Debug endpoint — shows how many keys are loaded (never reveals key values)
export async function GET(req: NextRequest) {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }

  return NextResponse.json({
    totalKeys: keys.length,
    keys: keys.map((k, i) => ({
      slot: i === 0 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i + 1}`,
      prefix: k.slice(0, 8) + "...",        // safe preview
      length: k.length,
    })),
    note: "Keys from same Google account share quota. Use different Gmail accounts for true rotation.",
  });
}

"use client";

export async function logFrontendError(args: {
  uid?: string;
  email?: string;
  errorType: string;
  errorMessage: string;
  severity?: "Low" | "Medium" | "High" | "Critical";
  stack?: string | null;
  userAction?: string;
  route?: string;
}) {
  try {
    const key = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "admin-secret-2025";
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({
        action: "logError",
        ...args,
        route: args.route || (typeof window !== "undefined" ? window.location.pathname : "/"),
      }),
    });
  } catch (e) {
    // silent
  }
}

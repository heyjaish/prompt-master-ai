import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth-context";

import ErrorTracker from "@/components/ErrorTracker";
import PresenceTracker from "@/components/PresenceTracker";

export const metadata: Metadata = {
  title: "Prompt Master AI — Specialist Prompt Engineering Tool",
  description: "Transform raw ideas into structured, professional AI prompts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <ErrorTracker />
          <PresenceTracker />
          {children}
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#1a1a1f", color: "#f0f0f2",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px", fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 8px 32px rgba(0,0,0,.5)",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#1a1a1f" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#1a1a1f" } },
          }}
        />
      </body>
    </html>
  );
}

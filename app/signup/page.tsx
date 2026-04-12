"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Signup = same as login (Google handles new + existing users)
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/login"); }, [router]);
  return null;
}

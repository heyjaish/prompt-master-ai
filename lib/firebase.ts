import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Guard against undefined API key at build/SSR time (Vercel static generation)
function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

const app = getFirebaseApp();

// Export with non-null assertion — these are only called in the browser
// where env vars are always present (set in Vercel dashboard)
export const auth           = app ? getAuth(app)        : null!;
export const db             = app ? getFirestore(app)   : null!;
export const googleProvider = new GoogleAuthProvider();

// Analytics: browser-only, lazy import
if (typeof window !== "undefined" && app) {
  import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
    isSupported().then(yes => { if (yes) getAnalytics(app!); });
  });
}

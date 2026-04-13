import {
  collection, doc, setDoc, getDocs,
  deleteDoc, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { HistoryEntry } from "./history";

const col = (uid: string) => collection(db, "users", uid, "history");

export const DEFAULT_MODEL = "gemini-3-flash-preview";

export async function savePrompt(uid: string, entry: HistoryEntry): Promise<void> {
  await setDoc(doc(col(uid), entry.id), entry);
}

export async function loadPrompts(uid: string): Promise<HistoryEntry[]> {
  const [hSnap, pSnap] = await Promise.all([
    getDocs(query(collection(db, "users", uid, "history"), orderBy("timestamp", "desc"), limit(40))),
    getDocs(query(collection(db, "users", uid, "prompts"), orderBy("timestamp", "desc"), limit(40))),
  ]);
  const merged = [...hSnap.docs.map(d=>d.data() as HistoryEntry), ...pSnap.docs.map(d=>d.data() as HistoryEntry)]
    .sort((a,b)=>b.timestamp - a.timestamp)
    .slice(0, 50);
  return merged;
}

export async function deletePrompt(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(col(uid), id));
}

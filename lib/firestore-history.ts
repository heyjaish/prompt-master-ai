import {
  collection, doc, setDoc, getDocs,
  deleteDoc, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { HistoryEntry } from "./history";

const col = (uid: string) => collection(db, "users", uid, "prompts");

export async function savePrompt(uid: string, entry: HistoryEntry): Promise<void> {
  await setDoc(doc(col(uid), entry.id), entry);
}

export async function loadPrompts(uid: string): Promise<HistoryEntry[]> {
  const snap = await getDocs(
    query(col(uid), orderBy("timestamp", "desc"), limit(50))
  );
  return snap.docs.map(d => d.data() as HistoryEntry);
}

export async function deletePrompt(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(col(uid), id));
}

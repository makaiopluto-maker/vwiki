import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function favDoc(uid: string, vtuberId: string) {
  return doc(db, "users", uid, "favorites", vtuberId);
}

export function subscribeFavorites(
  uid: string,
  onChange: (ids: Set<string>) => void
): () => void {
  return onSnapshot(collection(db, "users", uid, "favorites"), (snap) => {
    onChange(new Set(snap.docs.map((d) => d.id)));
  });
}

export async function setFavorite(
  uid: string,
  vtuberId: string,
  favorited: boolean
): Promise<void> {
  if (favorited) {
    await setDoc(favDoc(uid, vtuberId), { addedAt: Date.now() });
  } else {
    await deleteDoc(favDoc(uid, vtuberId));
  }
}

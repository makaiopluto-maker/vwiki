import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CommentEntry } from "@/lib/types";

const COLLECTION = "comments";

export function subscribeComments(
  vtuberId: string,
  onChange: (comments: CommentEntry[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where("vtuberId", "==", vtuberId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : Date.now();
        return { id: d.id, ...data, createdAt } as CommentEntry;
      })
    );
  });
}

export async function addComment(params: {
  vtuberId: string;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  text: string;
}): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    ...params,
    createdAt: serverTimestamp(),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, commentId));
}

/** 좋아요/싫어요 토글. value가 null이면 내 투표를 취소함 */
export async function voteComment(
  commentId: string,
  uid: string,
  value: 1 | -1 | null
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, commentId), {
    [`votes.${uid}`]: value === null ? deleteField() : value,
  });
}

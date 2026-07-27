import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RequestEntry } from "@/lib/types";

const COLLECTION = "requests";

/** 관리자 전용: 대기 중인 요청 목록 구독 */
export function subscribeRequests(
  onChange: (requests: RequestEntry[]) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : Date.now();
        return { id: d.id, ...data, createdAt } as RequestEntry;
      })
    );
  });
}

export async function addRequest(
  params: Omit<RequestEntry, "id" | "createdAt">
): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    ...params,
    createdAt: serverTimestamp(),
  });
}

/** 관리자 전용: 처리 완료된 요청 삭제 */
export async function deleteRequest(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

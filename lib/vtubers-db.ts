import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  increment,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VtuberEntry } from "@/lib/types";

const COLLECTION = "vtubers";

function fromSnapshot(snap: QuerySnapshot<DocumentData>): VtuberEntry[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VtuberEntry));
}

/** 실시간 구독: 목록 페이지에서 사용 (관리자가 추가/수정하면 자동 반영됨) */
export function subscribeVtubers(
  onChange: (vtubers: VtuberEntry[]) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy("name"));
  return onSnapshot(q, (snap) => onChange(fromSnapshot(snap)));
}

export async function getVtuberById(id: string): Promise<VtuberEntry | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as VtuberEntry;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** 관리자 전용: 추가/수정 (id를 문서 ID로 사용, upsert) */
export async function upsertVtuber(entry: VtuberEntry): Promise<void> {
  const { id, ...rest } = entry;
  await setDoc(doc(db, COLLECTION, id), stripUndefined(rest));
}

/** 조회수 +1 (누구나 호출 가능, views 필드만 수정) */
export async function incrementView(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { views: increment(1) });
  } catch (err) {
    console.error("조회수 증가 실패:", err);
  }
}

/** 관리자 전용: 삭제 */
export async function deleteVtuber(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

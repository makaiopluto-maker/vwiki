// data/vtubers.json에 있던 예시 데이터를 Firestore로 한 번 옮기는 스크립트.
// 실행 전 준비물:
// 1. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"으로
//    받은 JSON 파일을 프로젝트 루트에 serviceAccountKey.json 이름으로 저장
//    (이 파일은 절대 git에 커밋하지 마세요 - .gitignore에 이미 포함되어 있습니다)
// 2. npm install firebase-admin --save-dev
// 3. npm run migrate

import { readFile } from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  const serviceAccount = JSON.parse(
    await readFile(new URL("../serviceAccountKey.json", import.meta.url))
  );

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const raw = await readFile(new URL("../data/vtubers.json", import.meta.url), "utf-8");
  const vtubers = JSON.parse(raw);

  for (const v of vtubers) {
    const { id, ...rest } = v;
    await db.collection("vtubers").doc(id).set(rest);
    console.log(`✓ ${v.name} (${id}) 업로드 완료`);
  }

  console.log(`완료: ${vtubers.length}건 업로드됨`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Firestore의 vtubers 컬렉션을 돌면서 나무위키 "짧은 개요 발췌"만 채워넣는 스크립트.
// - CC BY-NC-SA 2.0 KR 라이선스 준수를 위해 문서 전체가 아니라
//   앞부분 텍스트를 최대 EXCERPT_MAX_LEN 글자까지만 잘라서 저장합니다.
// - 매 요청 사이에 딜레이를 둬서 나무위키 서버에 부담을 주지 않습니다.
//
// 실행 전 준비물 (GitHub Actions에서 자동 실행되도록 이미 구성되어 있음):
// - GitHub Secrets에 FIREBASE_SERVICE_ACCOUNT 라는 이름으로
//   서비스 계정 JSON 전체 내용을 등록해야 합니다.
// - 로컬에서 테스트하려면 프로젝트 루트에 serviceAccountKey.json을 두고
//   FIREBASE_SERVICE_ACCOUNT 환경변수 없이 실행하면 그 파일을 대신 읽습니다.

import { readFile } from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const EXCERPT_MAX_LEN = 220; // 라이선스 안전을 위해 짧게 유지
const REQUEST_DELAY_MS = 1500; // 요청 사이 딜레이 (서버 부담 방지)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** 나무위키 페이지의 og:description 메타태그에서 짧은 요약을 가져옴.
 *  이 값은 나무위키가 SNS 공유용으로 미리 만들어둔 깔끔한 요약이라
 *  본문을 직접 긁는 것보다 훨씬 안정적임 (편집 안내문/메뉴 텍스트 안 섞임). */
function extractOgDescription(html) {
  const metaTags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of metaTags) {
    if (/property=["']og:description["']/i.test(tag)) {
      const m = tag.match(/content=["']([^"']*)["']/i);
      if (m && m[1].trim()) return decodeEntities(m[1].trim());
    }
  }
  return null;
}

async function fetchExcerpt(namuUrl) {
  const res = await fetch(namuUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  if (!res.ok) {
    console.warn(`  ! ${namuUrl} 요청 실패 (${res.status})`);
    return null;
  }
  const html = await res.text();

  const ogDesc = extractOgDescription(html);
  if (ogDesc) return ogDesc.slice(0, EXCERPT_MAX_LEN);

  // og:description이 없는 예외적인 경우를 위한 폴백 (예전 방식)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleaned = text
    .replace(/이 저작물은 CC BY-NC-SA.*?위키위키입니다\./g, "")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, EXCERPT_MAX_LEN);
}

async function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  return JSON.parse(
    await readFile(new URL("../serviceAccountKey.json", import.meta.url))
  );
}

async function main() {
  const serviceAccount = await loadCredential();
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const snap = await db.collection("vtubers").get();
  const today = new Date().toISOString().slice(0, 10);

  for (const docSnap of snap.docs) {
    const v = docSnap.data();
    const namuUrl = v?.namu?.url;
    if (!namuUrl) continue;

    console.log(`- ${v.name} (${namuUrl}) 발췌 가져오는 중...`);
    const excerpt = await fetchExcerpt(namuUrl);

    if (excerpt) {
      await docSnap.ref.update({
        "namu.excerpt": excerpt,
        "namu.fetchedAt": today,
      });
      console.log(`  ✓ 저장됨 (${excerpt.length}자)`);
    } else {
      console.log(`  ✗ 실패 - 기존 값 유지`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log("완료: Firestore vtubers 컬렉션 업데이트됨");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

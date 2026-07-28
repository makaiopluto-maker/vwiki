// Firestore의 vtubers 컬렉션을 돌면서 나무위키에서 다음 두 가지만 가져와 채워넣는 스크립트.
// 1. "개요" 섹션 본문 (도입부 한 단락) - 원문 링크/출처 표시와 함께 짧게 노출됨
// 2. "PROFILE" 표의 사실 정보(성별/나이/생일/신장/MBTI/데뷔일 등) - 사실 데이터라 저작권 대상 아님
// 캐릭터 일러스트, 서명 이미지, 밈/서술형 본문 등 창작적 표현은 절대 가져오지 않습니다.
//
// 로컬에서 테스트하려면 프로젝트 루트에 serviceAccountKey.json을 두고 실행:
//   npm run fetch-namu

import { readFile } from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const EXCERPT_MAX_LEN = 220;
const OVERVIEW_MAX_LEN = 500;
const REQUEST_DELAY_MS = 1500;

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

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

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

function extractOverviewSection(html) {
  const startMarker = html.search(/id=["']s-1["']/i);
  const endMarker = html.search(/id=["']s-2["']/i);
  if (startMarker === -1 || endMarker === -1 || endMarker <= startMarker) {
    return extractOverviewSectionFallback(html);
  }

  const afterStart = html.slice(startMarker);
  const headingCloseMatch = afterStart.match(/<\/h[1-6]>/i);
  const contentStart = headingCloseMatch
    ? startMarker + headingCloseMatch.index + headingCloseMatch[0].length
    : startMarker;

  const endTagOpen = html.lastIndexOf("<", endMarker);
  const contentEnd = endTagOpen === -1 ? endMarker : endTagOpen;

  if (contentEnd <= contentStart) return extractOverviewSectionFallback(html);

  const cleaned = stripTags(html.slice(contentStart, contentEnd)).trim();
  if (cleaned.length < 5) return extractOverviewSectionFallback(html);
  return cleaned;
}

function extractOverviewSectionFallback(html) {
  const startIdx = html.search(/section=1["']/i);
  const endMatchIdx = html.search(/section=2["']/i);
  if (startIdx === -1 || endMatchIdx === -1 || endMatchIdx <= startIdx) {
    return null;
  }

  const afterStart = html.slice(startIdx);
  const anchorCloseIdx = afterStart.search(/<\/a>/i);
  if (anchorCloseIdx === -1) return null;
  const contentStart = startIdx + anchorCloseIdx + 4;

  const tagStart = html.lastIndexOf("<", endMatchIdx);
  const contentEnd = tagStart === -1 ? endMatchIdx : tagStart;
  if (contentEnd <= contentStart) return null;

  const cleaned = stripTags(html.slice(contentStart, contentEnd))
    .replace(/\s*\d+\.\s*\S*\s*$/, "")
    .trim();

  if (cleaned.length < 5) return null;
  return cleaned;
}

function extractProfileTable(html) {
  const startIdx = html.indexOf("PROFILE");
  if (startIdx === -1) return null;

  let endIdx = html.indexOf("SOCIAL", startIdx);
  if (endIdx === -1) endIdx = html.indexOf("SIGNATURE", startIdx);
  if (endIdx === -1) endIdx = startIdx + 6000;

  const chunk = html.slice(startIdx, endIdx);
  const rows = chunk.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  const profile = {};
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 2) continue;
    const label = stripTags(cells[0]);
    const value = stripTags(cells[1]);
    if (label && value && label.length <= 10 && value.length <= 120) {
      profile[label] = value;
    }
  }
  return Object.keys(profile).length ? profile : null;
}

async function fetchNamuData(namuUrl) {
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

  let excerpt = extractOverviewSection(html);
  if (excerpt) {
    excerpt = excerpt.slice(0, OVERVIEW_MAX_LEN);
  } else {
    const ogDesc = extractOgDescription(html);
    if (ogDesc) {
      excerpt = ogDesc.slice(0, EXCERPT_MAX_LEN);
    } else {
      const cleaned = stripTags(html).replace(
        /이 저작물은 CC BY-NC-SA.*?위키위키입니다\./g,
        ""
      );
      excerpt = cleaned ? cleaned.slice(0, EXCERPT_MAX_LEN) : null;
    }
  }

  const profile = extractProfileTable(html);

  return { excerpt, profile };
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

    console.log(`- ${v.name} (${namuUrl}) 가져오는 중...`);
    const result = await fetchNamuData(namuUrl);

    if (result?.excerpt) {
      const update = {
        "namu.excerpt": result.excerpt,
        "namu.fetchedAt": today,
      };
      if (result.profile) {
        update["namu.profile"] = result.profile;
      }
      await docSnap.ref.update(update);
      console.log(
        `  ✓ 저장됨 (개요 ${result.excerpt.length}자${
          result.profile ? `, 프로필 ${Object.keys(result.profile).length}개` : ""
        })`
      );
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
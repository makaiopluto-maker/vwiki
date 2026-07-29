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
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// "150cm[1]" 처럼 남는 각주 번호 표시를 제거
function stripFootnoteRefs(str) {
  return str.replace(/\s*\[\d+\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<sup[\s\S]*?<\/sup>/gi, " ") // 각주 번호 제거
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

  // 시작: "개요" 제목 태그(<h2>...</h2> 등) 전체가 끝나는 지점부터
  // (제목 마커 앵커, 제목 글자, [편집] 링크까지 전부 건너뜀)
  const afterStart = html.slice(startMarker);
  const headingCloseMatch = afterStart.match(/<\/h[1-6]>/i);
  const contentStart = headingCloseMatch
    ? startMarker + headingCloseMatch.index + headingCloseMatch[0].length
    : startMarker;

  // 끝: 다음 제목 태그가 "시작"하는 지점 (그 제목의 글자가 아예 포함 안 되게)
  const endTagOpen = html.lastIndexOf("<", endMarker);
  const contentEnd = endTagOpen === -1 ? endMarker : endTagOpen;

  if (contentEnd <= contentStart) return extractOverviewSectionFallback(html);

  const cleaned = stripTags(html.slice(contentStart, contentEnd)).trim();
  if (cleaned.length < 5) return extractOverviewSectionFallback(html);
  return cleaned;
}

// id="s-1"/"s-2" 마커가 없는 예외적인 페이지를 위한 예전 방식 폴백
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

  // 태그 중간에서 안 잘리도록, 그 태그가 "시작"하는 지점까지만 사용
  const tagStart = html.lastIndexOf("<", endMatchIdx);
  const contentEnd = tagStart === -1 ? endMatchIdx : tagStart;
  if (contentEnd <= contentStart) return null;

  const cleaned = stripTags(html.slice(contentStart, contentEnd))
    .replace(/\s*\d+\.\s*\S*\s*$/, "") // 다음 제목 번호/제목 잔여물 제거
    .trim();

  if (cleaned.length < 5) return null;
  return cleaned;
}

/** "PROFILE" 표의 성별/나이/생일 등 사실 정보만 key-value로 추출.
 *  일러스트/서명(SIGNATURE) 이미지는 포함하지 않음. */
const PROFILE_FIELD_ORDER = [
  "성별",
  "종족",
  "나이",
  "생일",
  "신장",
  "반려동물",
  "반려묘",
  "반려견",
  "MBTI",
  "소속",
  "디자인",
  "Live2D",
  "오시마크",
  "팬네임",
  "데뷔",
];

function sortProfileFields(profile) {
  const sorted = {};
  for (const key of PROFILE_FIELD_ORDER) {
    if (key in profile) sorted[key] = profile[key];
  }
  for (const key of Object.keys(profile)) {
    if (!(key in sorted)) sorted[key] = profile[key];
  }
  return sorted;
}

/** 인포박스 표 범위를 찾음. "PROFILE" 글자가 있는 템플릿과, 글자 없이
 *  "개요" 제목 바로 앞에 표만 있는 템플릿 둘 다 지원. */
function locateInfoTableChunk(html) {
  const profileIdx = html.indexOf("PROFILE");
  if (profileIdx !== -1) {
    let endIdx = html.indexOf("SOCIAL", profileIdx);
    if (endIdx === -1) endIdx = html.indexOf("SIGNATURE", profileIdx);
    if (endIdx === -1) endIdx = profileIdx + 6000;
    return html.slice(profileIdx, endIdx);
  }

  // 폴백: "개요"(id="s-1") 제목 바로 앞에 있는 표를 인포박스로 간주
  const s1Idx = html.search(/id=["']s-1["']/i);
  if (s1Idx === -1) return null;
  const tableStart = html.lastIndexOf("<table", s1Idx);
  if (tableStart === -1) return null;
  const afterTableStart = html.slice(tableStart);
  const tableEndRel = afterTableStart.search(/<\/table>/i);
  if (tableEndRel === -1) return null;
  const tableEnd = tableStart + tableEndRel + "</table>".length;
  return html.slice(tableStart, tableEnd);
}

function extractProfileTable(html) {
  const chunk = locateInfoTableChunk(html);
  if (!chunk) return null;

  const rows = chunk.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  const profile = {};
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 2) continue;
    const label = stripTags(cells[0]);
    const value = stripFootnoteRefs(stripTags(cells[1]));
    if (
      label &&
      value &&
      !/^[|\s]+$/.test(value) &&
      label.length <= 10 &&
      value.length <= 150
    ) {
      profile[label] = value;
    }
  }
  return Object.keys(profile).length ? sortProfileFields(profile) : null;
}

/** 인포박스 표 안의 실제 링크(href)만 도메인으로 구분해서 뽑아냄.
 *  해시태그처럼 링크가 아닌 텍스트는 대상이 아님 (URL은 사실 정보라 가져와도 문제없음). */
function extractSocialLinks(html) {
  const chunk = locateInfoTableChunk(html);
  if (!chunk) return null;

  const hrefs = [...chunk.matchAll(/href=["']([^"']+)["']/gi)].map((m) =>
    decodeEntities(m[1])
  );

  const links = {};
  for (const href of hrefs) {
    if (/youtube\.com|youtu\.be/i.test(href) && !links.youtube) {
      links.youtube = href;
    } else if (/chzzk\.naver\.com/i.test(href) && !links.chzzk) {
      links.chzzk = href;
    } else if (/twitch\.tv/i.test(href) && !links.twitch) {
      links.twitch = href;
    } else if (/(twitter\.com|x\.com)/i.test(href) && !links.twitter) {
      links.twitter = href;
    } else if (/instagram\.com/i.test(href) && !links.instagram) {
      links.instagram = href;
    }
  }

  return Object.keys(links).length ? links : null;
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
  const socialLinks = extractSocialLinks(html);

  return { excerpt, profile, socialLinks };
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

      let addedPlatforms = 0;
      if (result.socialLinks) {
        const existing = v.platforms || {};
        for (const [key, value] of Object.entries(result.socialLinks)) {
          if (!existing[key]) {
            update[`platforms.${key}`] = value;
            addedPlatforms++;
          }
        }
      }

      await docSnap.ref.update(update);
      console.log(
        `  ✓ 저장됨 (개요 ${result.excerpt.length}자${
          result.profile ? `, 프로필 ${Object.keys(result.profile).length}개` : ""
        }${addedPlatforms ? `, 플랫폼 링크 ${addedPlatforms}개 추가` : ""})`
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

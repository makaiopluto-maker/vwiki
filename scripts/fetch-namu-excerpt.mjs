// Firestore의 vtubers 컬렉션을 돌면서 나무위키에서 다음 세 가지만 가져와 채워넣는 스크립트.
// 1. "개요" 섹션 본문 (도입부 한 단락) - 원문 링크/출처 표시와 함께 짧게 노출됨
// 2. 프로필 정보(성별/나이/생일/신장/MBTI/데뷔일 등) - 사실 데이터라 저작권 대상 아님.
//    표(<table>), 정의목록(<dl>), 일반 div 등 어떤 구조로 되어있든 실제 HTML을
//    파싱해서 "라벨 텍스트가 알려진 이름과 정확히 같은지"로 판단하기 때문에
//    문서마다 인포박스 템플릿이 달라도 잘 동작함.
// 3. 방송/SNS 플랫폼 링크 - 마찬가지로 URL 도메인으로 구분해서 가져옴.
// 캐릭터 일러스트, 서명 이미지, 밈/서술형 본문 등 창작적 표현은 절대 가져오지 않습니다.
//
// 로컬에서 테스트하려면 프로젝트 루트에 serviceAccountKey.json을 두고 실행:
//   npm run fetch-namu
// (최초 1회 `npm install cheerio --save-dev` 필요 - package.json에 이미 추가되어 있음)

import { readFile } from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as cheerio from "cheerio";

const EXCERPT_MAX_LEN = 220;
const OVERVIEW_MAX_LEN = 500;
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFootnoteRefs(str) {
  return str.replace(/\s*\[\d+\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

const PROFILE_LABEL_WHITELIST = new Set([
  "성별", "종족", "나이", "생일", "생년월일", "별자리", "신장", "키", "체중", "혈액형",
  "반려동물", "반려묘", "반려견", "MBTI", "소속", "디자인", "일러스트", "일러스트레이터",
  "Live2D", "Live2D 리깅", "3D 모델", "오시마크", "팬네임", "데뷔",
  "데뷔일", "데뷔날짜", "국적", "거주", "거주지", "언어", "별명", "취미", "특기",
  "좋아하는 것", "싫어하는 것", "펜 캐릭터", "팔로워", "구독자",
]);

const PROFILE_FIELD_ORDER = [
  "성별", "종족", "나이", "생일", "생년월일", "별자리", "신장", "키", "체중", "혈액형",
  "국적", "거주", "거주지", "언어", "반려동물", "반려묘", "반려견", "MBTI",
  "소속", "디자인", "일러스트", "일러스트레이터", "Live2D", "Live2D 리깅", "3D 모델",
  "오시마크", "팬네임", "별명", "취미", "특기", "좋아하는 것", "싫어하는 것",
  "펜 캐릭터", "데뷔", "데뷔일", "데뷔날짜", "팔로워", "구독자",
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

function cleanText($, el) {
  return $(el).text().replace(/\s+/g, " ").trim();
}

/** 표든 정의목록(dl)이든 일반 div든, 라벨 텍스트가 화이트리스트와
 *  정확히 일치하면 그 "다음 형제 요소"를 값으로 취급해서 프로필 정보를 감지함. */
function extractProfile($) {
  const profile = {};

  // 1) 표 구조 (<tr><td>라벨</td><td>값</td></tr>)
  $("tr").each((_, tr) => {
    const cells = $(tr).children("td, th");
    if (cells.length < 2) return;
    const label = cleanText($, cells[0]);
    if (!PROFILE_LABEL_WHITELIST.has(label) || label in profile) return;
    const value = stripFootnoteRefs(cleanText($, cells[1]));
    if (value && !/^[|\s]+$/.test(value) && value.length <= 150) {
      profile[label] = value;
    }
  });

  // 2) 정의목록 구조 (<dt>라벨</dt><dd>값</dd>)
  $("dt").each((_, dt) => {
    const label = cleanText($, dt);
    if (!PROFILE_LABEL_WHITELIST.has(label) || label in profile) return;
    const dd = $(dt).next("dd");
    if (!dd.length) return;
    const value = stripFootnoteRefs(cleanText($, dd));
    if (value && !/^[|\s]+$/.test(value) && value.length <= 150) {
      profile[label] = value;
    }
  });

  // 3) 그 외 일반적인 형태 (라벨 요소 바로 다음 형제 요소가 값인 경우) - 폴백
  $("*").each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 0) return; // 하위 요소가 있으면 라벨 후보 아님
    const label = cleanText($, el);
    if (!PROFILE_LABEL_WHITELIST.has(label) || label in profile) return;
    const sib = $el.next();
    if (!sib.length) return;
    const value = stripFootnoteRefs(cleanText($, sib));
    if (value && !/^[|\s]+$/.test(value) && value.length <= 150) {
      profile[label] = value;
    }
  });

  return Object.keys(profile).length ? sortProfileFields(profile) : null;
}

/** 실제 링크(href)만 도메인으로 구분해서 뽑아냄. 먼저 나온 것만 사용.
 *  해시태그처럼 링크가 아닌 텍스트는 대상이 아님 (URL은 사실 정보라 가져와도 문제없음). */
function extractSocialLinks($) {
  const links = {};
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
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
    } else if (/kick\.com/i.test(href) && !links.kick) {
      links.kick = href;
    } else if (/tiktok\.com/i.test(href) && !links.tiktok) {
      links.tiktok = href;
    } else if (/discord\.(gg|com)/i.test(href) && !links.discord) {
      links.discord = href;
    } else if (/reddit\.com/i.test(href) && !links.reddit) {
      links.reddit = href;
    }
  });
  return Object.keys(links).length ? links : null;
}

/** "개요" 섹션(id="s-1" 제목 ~ id="s-2" 제목 사이) 본문만 추출. */
function extractOverview($) {
  const heading = $('[id="s-1"]').closest("h1,h2,h3,h4,h5,h6");
  if (!heading.length) return null;

  const parts = [];
  let node = heading.next();
  let guard = 0;
  while (node.length && guard < 200) {
    guard++;
    if (node.is("h1,h2,h3,h4,h5,h6") || node.find('[id="s-2"]').length) break;
    const text = cleanText($, node);
    if (text) parts.push(text);
    node = node.next();
  }

  const joined = parts.join(" ").trim();
  return joined.length >= 5 ? joined : null;
}

function extractOgDescription($) {
  const content = $('meta[property="og:description"]').attr("content");
  return content && content.trim() ? content.trim() : null;
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
  const $ = cheerio.load(html);

  let excerpt = extractOverview($);
  if (excerpt) {
    excerpt = excerpt.slice(0, OVERVIEW_MAX_LEN);
  } else {
    const ogDesc = extractOgDescription($);
    if (ogDesc) {
      excerpt = ogDesc.slice(0, EXCERPT_MAX_LEN);
    } else {
      const bodyText = cleanText($, $("body")).replace(
        /이 저작물은 CC BY-NC-SA.*?위키위키입니다\./g,
        ""
      );
      excerpt = bodyText ? bodyText.slice(0, EXCERPT_MAX_LEN) : null;
    }
  }

  const profile = extractProfile($);
  const socialLinks = extractSocialLinks($);

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

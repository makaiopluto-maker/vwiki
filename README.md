# 버튜버 편성표 (VTuber Info Board)

버튜버 방송 플랫폼 링크 + 나무위키 개요 발췌 + Google 로그인 + 즐겨찾기 + 댓글 +
관리자 데이터 편집 기능이 있는 사이트.
Next.js 15 static export → GitHub Pages 배포, Firebase(Auth + Firestore) 백엔드.

## 로컬에서 실행하기

```bash
npm install
npm run dev
```

## 데이터 구조가 바뀌었어요

이제 버튜버 데이터는 `data/vtubers.json` 파일이 아니라 **Firestore**의 `vtubers`
컬렉션에 저장됩니다. `data/vtubers.json`은 최초 1회 Firestore로 옮기는 용도로만
남아있어요 (`npm run migrate`).

### 최초 1회: 예시 데이터 Firestore로 옮기기

1. Firebase 콘솔 → 프로젝트 설정 → "서비스 계정" 탭 → "새 비공개 키 생성"
2. 다운로드된 JSON을 프로젝트 루트에 `serviceAccountKey.json` 이름으로 저장
   (`.gitignore`에 이미 포함되어 있어서 git에는 안 올라가요)
3. 실행:
   ```bash
   npm run migrate
   ```

### 이후 데이터 추가/수정

`/admin/` 페이지에서 로그인 후 직접 추가/수정/삭제하면 됩니다. (관리자 이메일은
`lib/admin.ts`에 등록되어 있어요.)

## 로그인 / 즐겨찾기 / 댓글

- 홈 화면 우측 상단 "Google로 로그인" 버튼으로 로그인
- 로그인하면 각 카드에 ★ 즐겨찾기 버튼이 활성화되고, "즐겨찾기만" 필터도 사용 가능
- 각 버튜버 상세 페이지 하단에 댓글 작성/삭제 가능 (본인 댓글 또는 관리자만 삭제 가능)
- `lib/admin.ts`의 `ADMIN_EMAILS` 배열에 등록된 이메일로 로그인하면 우측 상단에
  "관리자" 버튼이 나타나고 `/admin/`에서 데이터 관리 가능

## Firestore 보안 규칙 배포하기

⚠️ **중요**: Firestore를 "테스트 모드"로 만들었다면 **30일 후 자동으로 모든 읽기/쓰기가
차단**돼요. 아래 규칙을 꼭 배포/게시해두세요 (30일 안에 해도 되고 지금 해도 됩니다).

`firestore.rules`, `firestore.indexes.json` 파일을 이미 만들어뒀어요. Firebase CLI로
배포하려면:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # 기존 프로젝트 선택, rules/indexes 파일은 기존 것 사용
firebase deploy --only firestore:rules,firestore:indexes
```

CLI 설치가 번거로우면 Firebase 콘솔 → Firestore Database → 규칙 탭에서
`firestore.rules` 내용을 그대로 복사해서 붙여넣고 게시해도 됩니다. (댓글 목록 조회 시
"인덱스가 필요합니다" 에러가 뜨면, 에러 메시지에 있는 링크를 클릭하면 자동으로
인덱스를 만들어줘요 — `firestore.indexes.json`을 CLI로 배포하는 것과 동일한 효과예요.)

## 나무위키 연동 관련 중요 사항

이 사이트는 나무위키 문서를 통째로 복제하지 않습니다. `scripts/fetch-namu-excerpt.mjs`는
Firestore의 `vtubers` 컬렉션을 돌면서 각 문서의 개요 앞부분 최대 220자 정도만 가져와
`namu.excerpt` 필드를 갱신합니다. 화면에는 항상 원문 링크와 CC BY-NC-SA 2.0 KR 출처
표시가 함께 나오도록 설계되어 있습니다. 사이트에 광고 등 수익화 요소를 추가할 계획이면
이 발췌 기능은 다시 검토해야 합니다 (비영리 조건).

### GitHub Actions에서 자동 실행되게 하기 (매일 1회)

1. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → JSON 다운로드
2. 그 JSON 파일 내용을 **통째로 복사**
3. GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: 방금 복사한 JSON 전체 내용을 그대로 붙여넣기
4. 이제 매일 새벽 3시(KST)에 자동으로 갱신되고, Actions 탭에서
   "Update Namuwiki Excerpts" 워크플로우를 수동으로도 실행(`workflow_dispatch`)할 수 있어요

### 로컬에서 테스트하려면

`serviceAccountKey.json`을 프로젝트 루트에 두고:
```bash
npm run fetch-namu
```

## GitHub Pages 배포

`next.config.mjs`의 `basePath`가 저장소 이름(`vwiki`)과 일치해야 합니다. 이미
`/vwiki`로 맞춰져 있어요. 저장소 이름을 바꾸면 이 값도 같이 바꿔주세요.

1. push하면 `.github/workflows/deploy.yml`이 자동으로 빌드/배포
2. Settings → Pages → Source가 "GitHub Actions"로 되어있는지 확인

## 실시간 라이브 상태 표시 (아직 미구현)

Chzzk/유튜브 라이브 여부를 브라우저에서 직접 호출하면 CORS로 막히는 경우가 많아서,
중계 서버(예: 예전에 만드셨던 `chzzk-api.onrender.com` 같은 프록시)가 별도로 필요해요.
이 부분은 별도로 요청하시면 이어서 만들어드릴게요.

## 광고 관련

현재 구성에는 광고가 없습니다. 나무위키 발췌 기능을 유지하는 한, 광고나 후원 버튼을
추가하는 것은 라이선스(NC 조건) 위반 소지가 있으니 추가하지 않는 것을 권장합니다.

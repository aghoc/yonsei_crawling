# 🔄 [어디수업] 파이프라인 자동화 계획서 (Automation Plan)

## 1. 현황 분석 — 현재 수동 파이프라인

```
[수동 실행]                    [수동 실행]                [수동 실행]
npm start                     npm run etl                npm run upload
    │                             │                          │
    ▼                             ▼                          ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────────┐
│  crawler.js  │          │   etl.js     │          │   upload.js      │
│  Phase 1→2→3 │  ─────►  │  Transform   │  ─────►  │  Firestore Write │
│  ~9분 소요   │          │  ~1초 소요   │          │  ~1초 소요       │
└──────────────┘          └──────────────┘          └──────────────────┘
        │                         │                          │
        ▼                         ▼                          ▼
  all-2026-10.json        etl_result-2026-10.json    schedules_2026_1
   (원본 Raw)              (변환 결과)               (Firestore Collection)
```

### 현재 문제점

| 문제 | 설명 |
|------|------|
| **학년도/학기 하드코딩** | `crawler.js`에 `YEAR='2026'`, `SEMESTER='10'`이 고정값 |
| **파일 경로 하드코딩** | `etl.js`, `upload.js`에 `all-2026-10.json` 등 고정 경로 |
| **Collection 이름 하드코딩** | `upload.js`에 `schedules_2026_1` 고정 |
| **3단계 수동 실행** | `npm start` → `npm run etl` → `npm run upload`를 사람이 직접 순서대로 실행해야 함 |
| **스케줄링 없음** | 매학기 초 수강편람 데이터가 올라오는 시점에 수동으로 돌려야 함 |

---

## 2. 목표 아키텍처 — 자동화 파이프라인

```
GitHub Actions (Cron Schedule)
┌─────────────────────────────────────────────────────────┐
│  Trigger: 매년 2월 1일 & 8월 1일 (학기 시작 전)           │
│                                                         │
│  ┌─ Step 1 ─┐   ┌─ Step 2 ─┐   ┌─ Step 3 ─┐           │
│  │ Crawl    │──►│ ETL      │──►│ Upload   │           │
│  │ (동적    │   │ Transform│   │ Firestore│           │
│  │ 학기계산)│   │          │   │          │           │
│  └──────────┘   └──────────┘   └──────────┘           │
│                                                         │
│  환경변수:                                               │
│   - FIREBASE_SERVICE_ACCOUNT (GitHub Secret)             │
│   - YEAR / SEMESTER (자동 계산 또는 수동 트리거)            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 작업 항목 (3단계)

### Phase A: 스크립트 리팩토링 — CLI 인자 기반 동적 실행

현재 하드코딩된 학년도/학기를 **CLI 인자 또는 환경변수**로 받도록 리팩토링합니다.

#### A-1. `crawler.js` 수정

```javascript
// 변경 전 (하드코딩)
const YEAR = '2026';
const SEMESTER = '10';

// 변경 후 (환경변수 / CLI 인자)
const YEAR     = process.env.YEAR     || process.argv[2] || new Date().getFullYear().toString();
const SEMESTER = process.env.SEMESTER || process.argv[3] || (new Date().getMonth() < 7 ? '10' : '20');
// 1~6월 → 10(1학기), 7~12월 → 20(2학기) 자동 판별
```

#### A-2. `etl.js` 수정

```javascript
// 변경 전 (하드코딩)
const INPUT_FILE  = './data/all-2026-10.json';
const OUTPUT_FILE = './data/etl_result-2026-10.json';

// 변경 후 (동적)
const YEAR     = process.env.YEAR     || process.argv[2] || '2026';
const SEMESTER = process.env.SEMESTER || process.argv[3] || '10';
const INPUT_FILE  = `./data/all-${YEAR}-${SEMESTER}.json`;
const OUTPUT_FILE = `./data/etl_result-${YEAR}-${SEMESTER}.json`;
```

#### A-3. `upload.js` 수정

```javascript
// 변경 전 (하드코딩)
const ETL_RESULT_FILE = './data/etl_result-2026-10.json';
const COLLECTION_NAME = 'schedules_2026_1';

// 변경 후 (입력 파일은 동적, 타겟 컬렉션은 앱 하드코딩 유지 위해 고정)
const YEAR     = process.env.YEAR     || process.argv[2] || '2026';
const SEMESTER = process.env.SEMESTER || process.argv[3] || '10';
const ETL_RESULT_FILE = `./data/etl_result-${YEAR}-${SEMESTER}.json`;
const COLLECTION_NAME = 'schedules_2026_1'; // (유지)
```

#### A-4. 원커맨드 통합 스크립트 `pipeline.js` 신규 작성

```javascript
// 3단계를 하나의 스크립트에서 순차 실행
// node pipeline.js [YEAR] [SEMESTER]
//
// 1) crawler.js 실행 (spawn)
// 2) etl.js 실행
// 3) upload.js 실행
// 4) 최종 리포트 출력
```

#### A-5. `package.json` 스크립트 추가

```json
{
  "scripts": {
    "start": "node crawler.js",
    "etl": "node etl.js",
    "upload": "node upload.js",
    "pipeline": "node pipeline.js",
    "pipeline:2026-1": "YEAR=2026 SEMESTER=10 node pipeline.js",
    "pipeline:2026-2": "YEAR=2026 SEMESTER=20 node pipeline.js"
  }
}
```

---

### Phase B: GitHub Actions 워크플로우 구성

#### B-1. Cron 스케줄 트리거

```yaml
# .github/workflows/crawl-pipeline.yml
name: 어디수업 크롤링 파이프라인

on:
  # 자동 실행: 매년 2/1, 8/1 09:00 KST
  schedule:
    - cron: '0 0 1 2,8 *'   # UTC 00:00 = KST 09:00

  # 수동 실행: 학년도/학기 직접 지정 가능
  workflow_dispatch:
    inputs:
      year:
        description: '학년도 (예: 2026)'
        required: false
      semester:
        description: '학기코드 (10=1학기, 20=2학기)'
        required: false
```

#### B-2. Job 정의

```yaml
jobs:
  crawl-etl-upload:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      # 학년도/학기 자동 계산
      - name: Set YEAR and SEMESTER
        run: |
          if [ -n "${{ inputs.year }}" ]; then
            echo "YEAR=${{ inputs.year }}" >> $GITHUB_ENV
            echo "SEMESTER=${{ inputs.semester }}" >> $GITHUB_ENV
          else
            YEAR=$(date +%Y)
            MONTH=$(date +%-m)
            if [ $MONTH -lt 7 ]; then SEMESTER=10; else SEMESTER=20; fi
            echo "YEAR=$YEAR" >> $GITHUB_ENV
            echo "SEMESTER=$SEMESTER" >> $GITHUB_ENV
          fi

      # Firebase 서비스 계정 키 (GitHub Secret → 파일)
      - name: Setup Firebase credentials
        run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > ./config/serviceAccountKey.json

      # 전체 파이프라인 실행
      - run: node pipeline.js
        env:
          YEAR: ${{ env.YEAR }}
          SEMESTER: ${{ env.SEMESTER }}

      # 결과 아티팩트 보관 (원본 + ETL 결과)
      - uses: actions/upload-artifact@v4
        with:
          name: crawl-data-${{ env.YEAR }}-${{ env.SEMESTER }}
          path: |
            data/all-*.json
            data/etl_result-*.json
```

#### B-3. GitHub Secret 등록

| Secret 이름 | 값 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `serviceAccountKey.json`의 전체 내용 (JSON 문자열) |

등록 방법: GitHub 리포지토리 → Settings → Secrets and variables → Actions → New repository secret

---

### Phase C: 안전장치 및 모니터링

#### C-1. 업로드 전 데이터 검증 게이트

`pipeline.js` 안에 ETL 결과물을 자동 검증하는 로직을 넣습니다.

```javascript
// 업로드 전 자동 검증
function validateETLResult(data) {
  const docs = Object.keys(data);
  const errors = [];

  if (docs.length < 100) errors.push(`Document 수가 너무 적음: ${docs.length}개`);
  if (docs.length > 500) errors.push(`Document 수가 비정상적으로 많음: ${docs.length}개`);

  for (const id of docs) {
    const d = data[id];
    if (!d.building) errors.push(`${id}: building 필드 누락`);
    if (!Array.isArray(d.classes)) errors.push(`${id}: classes 배열 아님`);
    if (d.classes.length === 0) errors.push(`${id}: 빈 classes 배열`);
  }

  return errors;
}
```

#### C-2. 실패 알림

GitHub Actions 실패 시 자동으로 이메일 알림이 발생합니다. 추가로 Slack/Discord 웹훅 연동도 가능합니다.

#### C-3. Collection 업데이트 방식 (현재: 고정 덮어쓰기)

앱 클라이언트에 컬렉션명이 하드코딩되어 있으므로, 자동화 스케줄이 당분간 **신규 학기 데이터도 기존 `schedules_2026_1` 컬렉션에 그대로 덮어쓰는 구조**로 동작합니다.
추후 앱에서 원격 설정(Remote Config) 등을 통해 동적으로 컬렉션 이름을 받게 고치면, 스크립트도 동적으로 새 컬렉션을 생성하게 변경할 수 있습니다.

---

## 4. 예상 산출물

| 파일 | 설명 |
|------|------|
| `pipeline.js` | 크롤링→ETL→업로드를 한 번에 실행하는 통합 스크립트 |
| `crawler.js` (수정) | YEAR/SEMESTER를 환경변수/인자로 받도록 리팩토링 |
| `etl.js` (수정) | 파일 경로를 동적 생성하도록 리팩토링 |
| `upload.js` (수정) | Collection 이름을 동적 생성하도록 리팩토링 |
| `.github/workflows/crawl-pipeline.yml` | GitHub Actions 자동화 워크플로우 |

---

## 5. 실행 시나리오

### 시나리오 1: 자동 실행 (Cron)

```
2027년 2월 1일 09:00 KST
  → GitHub Actions 자동 트리거
  → YEAR=2027, SEMESTER=10 자동 계산
  → 크롤링 (9분) → ETL (1초) → Firebase 업로드 (1초)
  → 기존 schedules_2026_1 Collection에 최신 데이터 매핑 완료
  → 결과 데이터 Artifact로 보관
```

### 시나리오 2: 수동 실행 (Workflow Dispatch)

```
수강편람 데이터가 예상보다 늦게 올라온 경우
  → GitHub Actions → Run workflow 버튼 클릭
  → year: 2027, semester: 10 입력
  → 동일한 파이프라인 실행
```

### 시나리오 3: 로컬 수동 실행 (긴급)

```bash
# 환경변수 방식
YEAR=2027 SEMESTER=10 node pipeline.js

# 또는 인자 방식
node pipeline.js 2027 10
```

---

## 6. 구현 우선순위

| 순서 | 작업 | 난이도 | 소요 시간 |
|------|------|--------|----------|
| **1** | 스크립트 리팩토링 (A-1~A-3) | ⭐⭐ | 10분 |
| **2** | `pipeline.js` 통합 스크립트 (A-4) | ⭐⭐ | 15분 |
| **3** | 검증 게이트 추가 (C-1) | ⭐ | 5분 |
| **4** | GitHub Actions 워크플로우 (B) | ⭐⭐⭐ | 10분 |
| **5** | GitHub Secret 등록 | ⭐ | 2분 |

# 어디수업 — 수강편람 동적 크롤러 v2.0

연세대학교 수강편람 데이터를 **2-Depth 동적 스크래핑** 방식으로 전체 수집하는 Node.js 크롤러입니다.

## 아키텍처

```
Phase 1: 대학(원)분류 목록 동적 수집 (dsUnivCd)
    ↓ Loop
Phase 2: 각 대학별 개설학과 목록 동적 수집 (dsFaclyCd)
    ↓ Nested Loop
Phase 3: 학과 단위 수업 데이터 수집 (findAtnlcHandbList)
    ↓
중복 제거 → all-{year}-{semester}.json 저장
```

## 빠른 시작

```bash
# 1) 의존성 설치
npm install

# 2) 전체 파이프라인 실행 (Phase 1 → 2 → 3)
npm start

# 3) Phase 1만 실행 (대학분류 목록 확인)
npm run phase1

# 4) Phase 1 + 2 실행 (학과 목록까지 확인)
npm run phase2
```

## 출력 파일

| 파일 | 설명 |
|------|------|
| `data/phase1_univ_list.json` | Phase 1 결과: 대학분류 목록 |
| `data/phase2_dept_list.json` | Phase 2 결과: 전체 학과 목록 (대학 소속 매핑 포함) |
| `data/all-{year}-{semester}.json` | **최종 결과**: 전체 수업 데이터 (중복 제거 완료) |

## Guardrails

- **Zero-Hardcoding**: 모든 대학/학과 코드는 실행 시점에 API로부터 동적 수집
- **Rate Limiting**: 모든 API 호출 사이 최소 1.2초 지연
- **재시도 로직**: 실패 시 최대 3회 재시도 (지수적 백오프)
- **빈 배열 방어**: 하위 학과가 없는 대학분류는 안전하게 Skip
- **200건 경고**: 응답이 200건 상한에 도달하면 경고 출력

## 설정 변경

`crawler.js` 상단의 설정값을 수정하세요:

```js
const YEAR = '2026';        // 학년도
const SEMESTER = '10';       // 학기 (10=1학기, 20=2학기)
const CAMPUS_CODE = 's2';    // 캠퍼스 (s2=미래)
const DELAY_MS = 1200;       // API 호출 간 지연 (ms)
```

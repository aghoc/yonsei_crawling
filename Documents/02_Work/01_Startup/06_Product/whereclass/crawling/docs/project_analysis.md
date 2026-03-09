# 프로젝트 분석 보고서 (whereclass-crawler v2.0)

> 최종 갱신: 2026-03-09

## 1. 프로젝트 개요

본 프로젝트는 연세대학교 수강편람 학사 정보(`underwood1.yonsei.ac.kr`)를 **2-Depth 동적 스크래핑** 방식으로 전량 수집하기 위해 Node.js 환경에서 개발된 크롤러(Scraper) 애플리케이션입니다.

### 주요 기술 스택
- **Language**: JavaScript (Node.js, ES Modules)
- **Dependencies**:
  - `axios` (^1.5.0) — HTTP 비동기 통신 클라이언트
  - `qs` (^6.11.0) — URL-Encoded Form Data 직렬화
- **Project Root**: `crawling/`

---

## 2. 아키텍처 (3-Phase Pipeline)

```
┌──────────────────────────────────────────────┐
│  Phase 1: 대학(원)분류 목록 수집              │
│  POST /findSchSlesHandbList.do               │
│  dsNm = dsUnivCd → deptCd 배열 추출          │
└──────────────┬───────────────────────────────┘
               ↓ Loop (각 대학 순회)
┌──────────────────────────────────────────────┐
│  Phase 2: 개설학과 목록 수집                  │
│  POST /findSchSlesHandbList.do               │
│  dsNm = dsFaclyCd, lv2 = {대학코드}          │
│  → 학과 deptCd 배열 추출                     │
└──────────────┬───────────────────────────────┘
               ↓ Nested Loop (각 학과 순회)
┌──────────────────────────────────────────────┐
│  Phase 3: 수업 데이터 수집                    │
│  POST /findAtnlcHandbList.do                 │
│  univCd + faclyCd 동적 할당                   │
│  → 개별 수업 JSON 적재                       │
└──────────────┬───────────────────────────────┘
               ↓
       중복 제거 → all-{year}-{semester}.json
```

### 핵심 설계 원칙
1. **Zero-Hardcoding**: 모든 대학/학과 코드는 실행 시점 API로부터 동적 획득
2. **Rate Limiting**: 모든 API 호출 사이 최소 1.2초 강제 지연
3. **Session 유지**: 단일 axios 인스턴스를 통한 Cookie 컨텍스트 유지
4. **방어적 프로그래밍**: 빈 배열/키 누락/null 에 대한 안전 처리
5. **재시도(Retry)**: 실패 시 지수적 백오프로 최대 3회 재시도

---

## 3. 주요 파일 구조

```
crawling/
├── crawler.js              # 메인 크롤러 (3-Phase 파이프라인)
├── package.json            # 프로젝트 설정 및 NPM 스크립트
├── README.md               # 프로젝트 사용법 가이드
├── cURL.md                 # Phase 3 수업 데이터 API cURL 원본
├── data/                   # 수집 데이터 출력 디렉터리
│   ├── phase1_univ_list.json     # Phase 1 결과
│   ├── phase2_dept_list.json     # Phase 2 결과
│   └── all-{year}-{semester}.json # 최종 수집 결과
└── docs/                   # 프로젝트 문서
    ├── spec.md             # 아키텍처 명세서
    ├── project_analysis.md # 프로젝트 분석 보고서 (본 문서)
    ├── cURL_univ.md        # Phase 1 API cURL 원본
    ├── json_univ.md        # Phase 1 응답 샘플
    ├── json_dept.md        # Phase 2 응답 샘플
    └── update.md           # 진행 상황 트래킹
```

---

## 4. API 통신 규격 요약

| Phase | 엔드포인트 | 핵심 파라미터 | 응답 키 |
|-------|-----------|-------------|--------|
| Phase 1 | `/SlescsCtr/findSchSlesHandbList.do` | `dsNm=dsUnivCd` | `dsUnivCd[]` |
| Phase 2 | `/SlescsCtr/findSchSlesHandbList.do` | `dsNm=dsFaclyCd`, `lv2={대학코드}` | `dsFaclyCd[]` |
| Phase 3 | `/SlessyCtr/findAtnlcHandbList.do` | `univCd={대학코드}`, `faclyCd={학과코드}` | (배열 동적 탐색) |

---

## 5. 실행 가이드

```bash
npm install              # 의존성 설치
npm start                # 전체 파이프라인 (Phase 1→2→3)
npm run phase1           # Phase 1만 (대학분류 확인용)
npm run phase2           # Phase 1+2 (학과목록까지 확인용)
```

---

## 6. 제약 사항 및 주의점

1. **200건 제한**: 서버가 1회 응답에 최대 200건만 반환. 학과 단위 분할 요청으로 대부분 해소되나, 특정 대형 학과(교양 등)는 200건 초과 가능성 존재
2. **세션 만료**: `JSESSIONID` 쿠키가 만료되면 인증 실패 발생 가능. 현재 외부 인증 없이 동작하는 공개 API를 사용하고 있어 주기적 세션 갱신이 필요할 수 있음
3. **서버 부하**: 대략 40개 대학 × 평균 10개 학과 = 400+ 회 API 호출이 발생. Rate Limiting 필수

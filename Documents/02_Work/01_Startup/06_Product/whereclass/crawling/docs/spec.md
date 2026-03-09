# 📄 [어디수업] 수강편람 데이터 수집 아키텍처 명세서 (API Spec & Workflow)

## 1. 개요 (Overview)

본 문서는 '어디수업' 애플리케이션의 핵심 기능인 시간표 연동 및 강의실 매핑을 위해, 연세포탈 수강편람 서버로부터 데이터를 안정적으로 수집(Scraping)하는 시스템의 아키텍처와 구현 규격을 정의합니다.

### 1.1. 해결 과제 (Problem Statement)

* **API 호출 제한:** 대상 서버는 1회 API 호출 시 반환되는 데이터 건수를 **최대 200건**으로 엄격히 제한하고 있습니다.
* **페이지네이션 부재:** 페이지 이동(`page`, `startRow` 등) 파라미터를 지원하지 않아 200건 초과 시 후속 데이터 수집이 원천적으로 불가능합니다.

### 1.2. 해결 전략 (Strategy)

* **2-Depth 동적 스크래핑(Drill-down):** 상위 카테고리(대학분류)에서 하위 카테고리(개설학과)까지 2단계에 걸쳐 메타데이터를 선행 수집합니다.
* **데이터 분할 요청:** 확보한 '개설학과'의 고유 ID를 기준으로 실제 수업 데이터를 요청하여, 모든 응답이 200건 이하의 안전 구간 내에 들어오도록 강제합니다.

---

## 2. 시스템 파이프라인 (Workflow)

데이터 수집 봇은 UI(브라우저 렌더링)를 무시하고 오직 백엔드 API와의 연쇄적인 통신 로직만 수행해야 합니다. 전체 파이프라인은 다음 3단계 순환 구조(Nested Loop)를 가집니다.

1. **Phase 1 (1-Depth 탐색):** 서버 전체의 `[대학(원)분류]` 목록과 고유 식별자(ID) 배열을 확보합니다.
2. **Phase 2 (2-Depth 탐색):** Phase 1에서 획득한 식별자를 순회하며, 각 대학에 종속된 `[개설학과]` 목록과 고유 식별자(ID) 배열을 확보합니다.
3. **Phase 3 (Target 수집):** Phase 2에서 획득한 최종 식별자를 순회하며, 학과 단위로 실제 `[수업 데이터]`를 서버에 요청하고 DB에 적재합니다.

---

## 3. API 통신 규격 (API Specifications)

Phase 1과 Phase 2는 동일한 API 엔드포인트를 공유하며, Payload(Body) 내부의 특정 파라미터(`dsNm`, `lv2`) 조작을 통해 응답 데이터를 분기합니다.

* **Target URL:** `https://underwood1.yonsei.ac.kr/sch/sles/SlescsCtr/findSchSlesHandbList.do`
* **HTTP Method:** `POST`
* **Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`

### 3.1. Phase 1: 대학(원)분류 조회 API

* **목적:** 최상위 카테고리(1-Depth) 메타데이터 확보
* **Request Payload (Key Parameters):**
* `@d1#dsNm` : `dsUnivCd` (고정 - 대학 데이터셋 지시자)
* `@d1#syy` : `2026` (수집 대상 학년도)
* `@d1#smtDivCd` : `10` (수집 대상 학기)


* **Response Parsing Rule:**
* 반환된 JSON 구조 내 `dsUnivCd` 배열에 접근.
* 배열 내 각 객체에서 `deptCd` (대학 고유 ID) 값을 추출하여 메모리에 저장.



### 3.2. Phase 2: 개설학과 조회 API

* **목적:** 특정 대학에 종속된 하위 카테고리(2-Depth) 메타데이터 확보
* **Request Payload (Key Parameters):**
* `@d1#dsNm` : `dsFaclyCd` (고정 - 학과 데이터셋 지시자)
* **`@d1#lv2` : `{Phase 1에서 추출한 deptCd}` (동적 할당 필수)**
* `@d1#syy` : `2026`
* `@d1#smtDivCd` : `10`


* **Response Parsing Rule:**
* 반환된 JSON 구조 내 `dsFaclyCd` 배열에 접근.
* 배열 내 각 객체에서 `deptCd` (학과 고유 ID) 값을 추출하여 메모리에 저장.



### 3.3. Phase 3: 최종 수업 데이터 조회 API

* **목적:** 실제 시간표 및 강의실 매핑 데이터 수집
* **Request Payload (Key Parameters):**
* *기존에 구현 성공한 수업 데이터 요청 API의 스펙을 따름.*
* **필수 조건:** Payload 내 단과대 파라미터 영역과 학과 파라미터 영역에 Phase 1, Phase 2에서 획득한 `deptCd` 값을 각각 동적으로 할당하여 호출.



---

## 4. 개발 제약 및 필수 준수 사항 (Guardrails)

본 스펙을 구현하는 모든 개발자는 다음 사항을 시스템에 반드시 반영해야 합니다.

1. **상수화 및 하드코딩 엄격 금지 (Zero-Hardcoding)**
* 대학 코드나 학과 코드를 소스 코드 내에 상수로 정의하지 마십시오. 학교 측의 시스템 개편(통폐합, 신설 등) 시 즉각적인 장애로 이어집니다.
* 모든 ID 값은 반드시 실행 시점에 API 통신을 통해 동적으로 확보한 데이터를 사용해야 합니다.


2. **호출 속도 제한 (Rate Limiting) 필수 적용**
* 2-Depth 순회 구조 특성상 짧은 시간 내에 수백 회 이상의 API 요청이 발생합니다.
* Target 서버의 방화벽(WAF)에 의한 IP Ban 또는 세션 차단을 방지하기 위해, 모든 API 호출 사이(Loop 내부)에 **최소 1초(1000ms) 이상의 Delay(Sleep)** 로직을 강제해야 합니다.


3. **단일 세션 컨텍스트 유지 (Session Management)**
* 최초 통신 시 발급되는 식별 쿠키(예: `JSESSIONID`, `_INSIGHT_CK_...` 등)가 전체 Phase 1~3 과정 동안 동일하게 유지되어야 합니다.
* 이를 위해 각 언어별 네트워크 라이브러리에서 제공하는 Session 관리 객체(Cookie Jar 등)를 적극 활용하여 연결을 유지하십시오.


4. **빈 배열(Empty Array) 예외 처리**
* 특정 대학분류(예: 학부개설 등)의 경우 하위 개설학과가 존재하지 않아 `dsFaclyCd` 배열이 비어있거나(`[]`) Key 자체가 누락되어 응답될 수 있습니다. Null Pointer Exception 방지를 위한 방어적 프로그래밍을 적용하십시오.

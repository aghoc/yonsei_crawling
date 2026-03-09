# Firebase 데이터 적재 작업 계획 (ETL Pipeline Plan)

## 1. 현황 정리 (Current Status)

현재 웹 크롤러(crawler.js)를 통해 연세포탈 수강편람 데이터 수집이 성공적으로 완료되었습니다. 주요 현황은 다음과 같습니다.

*   **수집 완료 상태**: 2-Depth 동적 스크래핑 파이프라인(대학분류 -> 개설학과 -> 수업데이터)이 안정적으로 동작하여, 한 번의 요청 당 200건 한도 제한을 완벽하게 우회하였습니다.
*   **수집 결과**: 2026학년도 1학기 기준 총 1,489건의 수업 데이터가 수집되었으며, `data/all-2026-10.json` 에 성공적으로 저장되었습니다. (데이터 손실 및 제한 초과 0건)
*   **목표**: 이제 수집된 비정형 Raw JSON 데이터를 '어디수업' 앱의 타임라인 UI 렌더링에 최적화된 형태로 가공하여(정제, 변환) Firebase Firestore에 적재하는 ETL(Extract, Transform, Load) 파이프라인을 구축해야 합니다.

---

## 2. 작업 계획 (Action Plan)

`docs/spec_firebase.md` 명세서를 바탕으로, 다음과 같이 3단계로 나누어 파이프라인 개발 및 데이터 적재를 진행합니다.

### Phase 1: 매핑 사전(Dictionary) 설정 및 환경 구성
데이터 정규화 및 변환에 필수적인 하드코딩 방지를 위한 매핑 사전을 구성합니다.
*   **작업 항목**:
    *   `config/` 디렉토리 신설 및 매핑 사전 파일 생성 (예: `mappings.js` 또는 `config.json`).
    *   **건물명 매핑 사전**: "백" -> "백운관", "청" -> "청송관" 등의 축약어 풀네임 치환 규칙 정의.
    *   **시간표 사상 사전**: 1교시(09:00~09:50), 2교시(10:00~10:50) 등 교시별 시작/종료 시간 매핑 규칙 정의.
    *   Firebase Admin SDK 초기화 및 서비스 계정 키(Service Account Key) 연동 준비.

### Phase 2: 데이터 파싱 및 가공 로직 (Transform) 구현
원본 JSON 데이터(`data/all-2026-10.json`)를 순회하며 명세서의 규칙(Rule 2.1 ~ 2.3)에 따라 데이터를 변환합니다. `etl.js` (가칭) 스크립트를 작성합니다.
*   **작업 항목**:
    *   **필터링**: 강의실(`lecrmNm`)이 null이거나 시간(`lctreTimeNm`)이 null인 예외 데이터 드롭(Drop) 로직 추가.
    *   **강의실 식별자 생성 (Rule 2.1)**: 강의실명 정규표현식 파싱 및 건물명 매핑을 통한 고유 Document ID 생성 (예: `백운관_121`).
    *   **시간표 완전 분할 (Rule 2.2)**: "월2,3"과 같은 연강 데이터를 독립된 블록 객체(월2, 월3)로 분리하고, 시작/종료 시간을 매핑.
    *   **속성 리네이밍 (Rule 2.3)**: `subjtNm2`를 `className`으로, `cgprfNm`을 `professor`로 변환하여 목표 객체 구조 포맷팅.
    *   **인메모리 그룹화 (Rule 4.1)**: 위 과정을 거친 후 강의실(Document ID)을 Key로 삼아, 여러 수업 블록 아이템들을 `classes` 배열(Array)에 병합(Grouping).
    *   **가공 결과물 개별 저장**: 원본 파일(`data/all-2026-10.json`)을 직접 수정(Overwriting)하지 않고, 파싱/가공된 최종 결과를 **완전히 새로운 파일**(예: `data/etl_result-2026-10.json`)로 분리하여 저장합니다. (Firebase 적재 전 데이터 검증용)

### Phase 3: Firebase Firestore 적재 (Load) 구현
가공이 완료된 데이터를 Firestore 스키마에 맞게 일괄 업로드합니다.
*   **작업 항목**:
    *   **Collection 기준 설정**: `schedules_2026_1` 컬렉션(Collection) 타겟팅.
    *   **Batch Write 적용**: Firestore의 일괄 쓰기(Batched Writes) 한도인 500개에 맞춰, 가공된 Document들을 청크(Chunk) 단위로 묶어서 `commit()` 수행.
    *   에러 핸들링 및 업로드 결과 요약 로깅(총 적재된 Document 수 지정 등).

---

## 3. 예상 산출물 (Expected Outputs)
*   **`config/mappings.js`**: 건물 및 시간표 매핑 딕셔너리.
*   **`etl.js`**: 데이터 정제 및 Firebase 적재를 함께 수행하는 Node.js 스크립트.
*   **`data/etl_result-2026-10.json`**: 원본을 훼손하지 않고 정제 및 그룹화 로직만이 모두 적용된 **새로운 결과물 JSON 파일**.
*   `Firebase Firestore` 내 표적 Collection(`schedules_2026_1`)에 정제된 강의실별 시간표 데이터 최종 업로드.

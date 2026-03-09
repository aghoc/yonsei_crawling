# 📄 [어디수업] 수강편람 데이터 전처리 및 Firebase 적재 명세서 (ETL Pipeline Spec)

## 1. 개요 (Overview)

본 문서는 연세포탈에서 스크래핑한 수강편람 원본 데이터(Raw JSON)를 '어디수업' 앱의 실시간 강의실 조회 및 **에브리타임(Everytime) 스타일의 타임라인 UI** 렌더링에 최적화된 NoSQL(Firebase Firestore) 구조로 변환하여 적재하는 파이프라인 규격을 정의합니다.

* **핵심 목표:** 비정형 문자열을 정형 데이터로 정제하고, 앱 클라이언트가 서버 연산 없이 단 1회의 Read 요청으로 특정 강의실의 일정을 블록(Block) 형태로 렌더링할 수 있도록 Document 중심의 데이터베이스를 구축합니다.

---

## 2. 데이터 변환 규칙 (Transformation Logic)

파이프라인은 원본 데이터의 각 객체(Row)를 순회하며 다음 3가지 핵심 파싱(Parsing) 규칙을 적용해야 합니다.

### Rule 2.1. 강의실 텍스트 정규화 및 고유 식별자(Document ID) 생성

포탈의 축약된 강의실명(`lecrmNm`)을 앱 내 지도 맵핑 기준에 맞춰 정규화하고, 이를 Firestore의 Document ID로 사용합니다.

* **Input:** `"백121"`, `"청104"`, `"대강당(원주)"`
* **Logic:**
1. 정규표현식을 사용하여 문자열(건물)과 숫자(호실)를 분리합니다.
2. 사전 정의된 **'건물명 맵핑 사전(Dictionary)'**을 참조하여 축약어를 풀네임으로 치환합니다.
3. 추출된 건물명과 호실을 언더바(`_`)로 조합하여 고유 키를 생성합니다.


* **Output Example:**
* `"백121"` ➡️ **Document ID: `"백운관_121"**`
* `"대강당(원주)"` ➡️ **Document ID: `"대강당"**`



### Rule 2.2. [UI 최적화] 시간표 텍스트 완전 분할 (Time Block Splitting)

압축된 교시 문자열(`lctreTimeNm`)을 요일과 개별 교시 단위로 **완전히 쪼개어(Split)** 변환합니다. 타임라인 격자(Grid) UI에 블록을 렌더링하기 위한 필수 조치입니다.

* **Input:** `"수2"`, `"월2,3"`
* **Logic (연강 분할 원칙):**
1. 정규표현식을 사용하여 요일과 교시 숫자를 분리합니다.
2. **[중요]** 콤마(`,`)로 연결된 연강(예: `2,3`)의 경우, 절대 시작/종료 시간을 하나로 병합(`10:00~11:50`)하지 않습니다.
3. 무조건 **1개의 교시당 1개의 독립된 객체(Object)**를 생성합니다.
4. 사전 정의된 **'학교 시간표 사전'**을 참조해 각 교시의 `startTime`과 `endTime`을 매핑합니다.


* **Output Example:**
* `"월2,3"` ➡️
`[ { day: "월", period: 2, startTime: "10:00", endTime: "10:50" },`
`  { day: "월", period: 3, startTime: "11:00", endTime: "11:50" } ]`



### Rule 2.3. 핵심 속성 추출

기타 필수 정보는 원본 키 값에서 직관적인 영문 키 값으로 리네이밍하여 할당합니다.

* 과목명: `subjtNm2` ➡️ `className` (괄호 설명이 제외된 깔끔한 과목명 사용)
* 교수명: `cgprfNm` ➡️ `professor`

---

## 3. 목표 데이터베이스 스키마 (Target Firestore Schema)

변환된 데이터는 앱에서 "특정 강의실 정보"를 즉시 찾아 타임라인에 그릴 수 있도록 철저하게 **'강의실(Document) ➡️ 개별 시간 블록 목록(Array)'** 구조로 적재되어야 합니다.

* **Collection Naming Convention:** `schedules_YYYY_S` (예: `schedules_2026_1`)

**Document Structure Example (`백운관_121`):**

```json
{
  "building": "백운관",
  "room": "121호",
  "classes": [
    {
      "className": "선형대수학",
      "professor": "김교수",
      "day": "월",
      "period": 2,
      "startTime": "10:00",
      "endTime": "10:50"
    },
    {
      "className": "선형대수학",  // 월3 연강이 독립된 블록으로 분리됨
      "professor": "김교수",
      "day": "월",
      "period": 3,
      "startTime": "11:00",
      "endTime": "11:50"
    },
    {
      "className": "채플",
      "professor": "강승일",
      "day": "화",
      "period": 9,
      "startTime": "17:00",
      "endTime": "17:50"
    }
  ]
}

```

---

## 4. Firebase 적재 정책 및 가이드라인 (Load Strategy)

1. **메모리 상 병합(In-Memory Grouping) 및 분할(Splitting) 동시 수행:**
* 원본 데이터는 '수업 단위'입니다. 이를 파이프라인 메모리 단에서 '강의실 단위'(`Document ID`)로 먼저 그룹화해야 합니다.
* 이와 동시에, 수업의 시간이 연강일 경우 `classes` 배열에 들어갈 아이템을 개별 교시 블록으로 쪼개서(Split) 넣어야 합니다.


2. **Batch Write (일괄 쓰기) 적용:**
* 네트워크 병목 및 Write 비용 방지를 위해 Firestore의 `Batch` 기능을 사용하여 500개(한도) 단위로 묶어서 일괄 커밋(Commit) 하십시오.


3. **Null / 예외 데이터 드롭(Drop):**
* 강의실이 미정이거나(`lecrmNm: null`), 시간이 미정인(`lctreTimeNm: null`) 데이터는 오프라인 지도 및 타임라인 매핑이 불가능하므로 파이프라인 단계에서 제외(Skip) 처리합니다.


4. **매핑 사전 중앙 관리:**
* 건물명 매핑 규칙과 시간표 규정은 하드코딩하지 말고 별도의 `config` 객체나 환경 변수로 분리하여 관리하십시오.
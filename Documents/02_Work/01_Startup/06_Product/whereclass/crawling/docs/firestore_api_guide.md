# 📄 [어디수업] Firestore 데이터 연동 가이드 및 API 스펙

## 1. 개요

본 문서는 `whereclass` 크롤링 파이프라인에 의해 **Firebase Firestore**에 적재된 강의실 시간표 데이터를 외부 앱(Flutter, Web, Node.js 등)에서 호출·연동하는 방법을 정의합니다.

### 핵심 콘셉트

```
유저: "백운관 121호 시간표 보여줘"
  ↓
앱:   db.collection('schedules_2026_1').doc('백운관_121').get()
  ↓
Firestore: Document 1개 (약 1~4KB) 반환 → 0.01초 이내
  ↓
앱:   타임라인 블록 UI 렌더링
```

**앱 클라이언트가 서버 연산 없이 단 1회의 Read 요청으로 특정 강의실의 전체 시간표를 렌더링할 수 있도록** 설계되어 있습니다.

---

## 2. Firebase 프로젝트 정보

| 항목 | 값 |
|------|------|
| **Project ID** | `whereclass` |
| **Collection 이름** | `schedules_2026_1` |
| **Collection 네이밍 규칙** | `schedules_{학년도}_{학기}` (예: `schedules_2026_1`) |
| **총 Document 수** | **196개** (강의실 단위) |
| **총 시간블록 수** | **2,946블록** |

---

## 3. 데이터 스키마 (Document 구조)

### 3.1. Collection / Document 계층

```
Firestore Root
 └─ schedules_2026_1          ← Collection (학기별)
     ├─ 백운관_121             ← Document (강의실별)
     ├─ 정의관_238
     ├─ 컨버젼스홀_103
     ├─ 대강당
     └─ ... (총 196개)
```

### 3.2. Document ID 규칙

| 패턴 | 예시 | 설명 |
|------|-----|------|
| `{건물명}_{호실번호}` | `백운관_121` | 일반적인 강의실 |
| `{건물명}_{호실번호}` | `산학관_403-2` | 하이픈 포함 호실 |
| `{건물명}` | `대강당` | 호실이 없는 단독 시설 |

### 3.3. Document 필드 구조

```json
{
  "building": "백운관",
  "room": "121호",
  "classes": [
    {
      "className": "바이오공학",
      "professor": "김지현",
      "day": "월",
      "period": 2,
      "startTime": "10:00",
      "endTime": "10:50"
    },
    {
      "className": "바이오공학",
      "professor": "김지현",
      "day": "월",
      "period": 3,
      "startTime": "11:00",
      "endTime": "11:50"
    }
  ]
}
```

### 3.4. 필드 명세

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `building` | `string` | 건물 풀네임 | `"백운관"` |
| `room` | `string \| null` | 호실 (없으면 null) | `"121호"`, `null` |
| **`classes`** | **`Array<Object>`** | **시간블록 배열** | 아래 참조 |

#### `classes[*]` 배열 아이템 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `className` | `string` | 과목명 | `"선형대수학"` |
| `professor` | `string` | 교수명 | `"김교수"` |
| `day` | `string` | 요일 (1글자) | `"월"`, `"화"`, ... `"일"` |
| `period` | `number` | 교시 번호 (0~15) | `2` |
| `startTime` | `string` | 시작 시각 (HH:mm) | `"10:00"` |
| `endTime` | `string` | 종료 시각 (HH:mm) | `"10:50"` |

### 3.5. 교시(period) ↔ 시간 매핑표

| 교시 | 시작 | 종료 |
|------|------|------|
| 0 | 08:00 | 08:50 |
| 1 | 09:00 | 09:50 |
| 2 | 10:00 | 10:50 |
| 3 | 11:00 | 11:50 |
| 4 | 12:00 | 12:50 |
| 5 | 13:00 | 13:50 |
| 6 | 14:00 | 14:50 |
| 7 | 15:00 | 15:50 |
| 8 | 16:00 | 16:50 |
| 9 | 17:00 | 17:50 |
| 10 | 18:00 | 18:50 |
| 11~15 | 19:00~23:50 | (야간) |

---

## 4. 건물 목록 (총 11개 건물, 196개 강의실)

| 건물명 | Document 수 | 포탈 축약어 |
|--------|------------|-----------|
| 창조관 | 35 | 창 |
| 백운관 | 34 | 백 |
| 정의관 | 30 | 정 |
| 청송관 | 29 | 청 |
| 미래관 | 25 | 미 |
| 컨버젼스홀 | 24 | 컨, 컨B |
| 연세플라자 | 11 | 연플 |
| 인력개발원 | 4 | 인력개발원 |
| 산학관 | 2 | 산, 벤처센터(레거시) |
| 대강당 | 1 | 대강당 |
| 스포츠센터 | 1 | 스 |

---

## 5. 연동 가이드 (플랫폼별 코드 예시)

### 5.1. Flutter (Dart) — 강의실 단건 조회

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

/// 특정 강의실의 시간표 데이터를 가져옵니다.
Future<Map<String, dynamic>?> getRoomSchedule(String roomId) async {
  // roomId 예: "백운관_121", "대강당"
  final doc = await FirebaseFirestore.instance
      .collection('schedules_2026_1')
      .doc(roomId)
      .get();

  if (!doc.exists) return null;
  return doc.data();
}

// 사용 예시
final data = await getRoomSchedule('백운관_121');
if (data != null) {
  final building = data['building'];  // "백운관"
  final room     = data['room'];      // "121호"
  final classes   = data['classes'] as List;

  for (final c in classes) {
    print('${c['day']} ${c['startTime']}~${c['endTime']} '
          '${c['className']} (${c['professor']})');
  }
}
```

### 5.2. Flutter (Dart) — 건물별 강의실 목록 조회

```dart
/// 특정 건물의 모든 강의실 Document를 가져옵니다.
Future<List<QueryDocumentSnapshot>> getRoomsByBuilding(String buildingName) async {
  final snap = await FirebaseFirestore.instance
      .collection('schedules_2026_1')
      .where('building', isEqualTo: buildingName)
      .get();

  return snap.docs;
}

// 사용 예시: "백운관"의 모든 강의실
final rooms = await getRoomsByBuilding('백운관');
for (final doc in rooms) {
  print('${doc.id}: ${doc.data()['room']}');
  // 백운관_121: 121호
  // 백운관_320: 320호
  // ...
}
```

### 5.3. Flutter (Dart) — 전체 건물 목록 가져오기

```dart
/// 전체 Document를 읽어 건물 목록(중복 제거)을 반환합니다.
Future<List<String>> getAllBuildings() async {
  final snap = await FirebaseFirestore.instance
      .collection('schedules_2026_1')
      .get();

  final buildings = <String>{};
  for (final doc in snap.docs) {
    buildings.add(doc.data()['building'] as String);
  }

  return buildings.toList()..sort();
}
```

### 5.4. Web (JavaScript) — 강의실 단건 조회

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function getRoomSchedule(roomId) {
  const snap = await getDoc(doc(db, 'schedules_2026_1', roomId));
  if (!snap.exists()) return null;
  return snap.data();
}

// 사용
const data = await getRoomSchedule('정의관_238');
console.log(data.building);  // "정의관"
console.log(data.classes);   // [{className, professor, day, period, ...}, ...]
```

### 5.5. Node.js (Admin SDK) — 서버 사이드 조회

```javascript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: cert('./config/serviceAccountKey.json') });
const db = getFirestore();

// 단건 조회
const doc = await db.collection('schedules_2026_1').doc('컨버젼스홀_103').get();
console.log(doc.data());

// 건물별 조회
const snap = await db.collection('schedules_2026_1')
  .where('building', '==', '청송관').get();
snap.docs.forEach(d => console.log(d.id, d.data().room));
```

---

## 6. 주요 쿼리 패턴 정리

| 유즈케이스 | Firestore 호출 | 결과 |
|-----------|---------------|------|
| **강의실 시간표 조회** | `.doc('백운관_121').get()` | Document 1개 (1~4KB) |
| **건물 내 전체 강의실** | `.where('building', '==', '백운관').get()` | 해당 건물 Document 배열 |
| **전체 강의실 목록** | `.collection('schedules_2026_1').get()` | 196개 Document |
| **특정 요일 수업 필터** | 클라이언트측 `classes.filter(c => c.day === '월')` | 월요일 블록만 추출 |
| **특정 교시 빈 강의실** | 클라이언트측 `classes` 없는 교시 역산 | 빈 강의실 목록 |

> **참고:** `classes`는 배열(Array) 내부에 각기 다른 구조의 객체가 들어있으므로, Firestore의 `array-contains` 쿼리로 직접 필터링이 불가합니다. 요일/시간 필터링은 Document를 읽은 뒤 **클라이언트에서 처리**하는 것을 권장합니다.

---

## 7. 타임라인 UI 렌더링 가이드

### 7.1. 에브리타임 스타일 격자형 시간표

`classes` 배열의 각 아이템이 격자(Grid)의 한 **블록(Cell)**에 1:1 대응됩니다.

```
        월        화        수        목        금
 2교시  ┌───────┐                    ┌───────┐
 10:00  │바이오  │                    │유기화학│
 10:50  │공학    │                    │       │
        └───────┘                    └───────┘
 3교시  ┌───────┐                    ┌───────┐
 11:00  │바이오  │                    │유기화학│
 11:50  │공학    │                    │       │
        └───────┘                    └───────┘
```

### 7.2. 렌더링 로직 (의사코드)

```
1. Document 읽기: doc('백운관_121').get()
2. classes 배열 순회:
   for (block in classes):
     x좌표 = dayToColumn(block.day)     // 월=0, 화=1, ...
     y좌표 = block.period               // 교시 번호
     label = block.className
     셀(x, y)에 블록 배치
3. 비어있는 셀 = 해당 시간에 수업 없음
```

### 7.3. "빈 강의실 찾기" 기능 구현

```dart
/// 특정 건물에서 주어진 요일+교시에 비어있는 강의실을 찾습니다.
Future<List<String>> findEmptyRooms({
  required String building,
  required String day,
  required int period,
}) async {
  final snap = await FirebaseFirestore.instance
      .collection('schedules_2026_1')
      .where('building', isEqualTo: building)
      .get();

  final emptyRooms = <String>[];
  for (final doc in snap.docs) {
    final classes = doc.data()['classes'] as List;
    final isOccupied = classes.any((c) =>
        c['day'] == day && c['period'] == period);

    if (!isOccupied) {
      emptyRooms.add(doc.id);
    }
  }
  return emptyRooms;
}

// 사용 예시: 월요일 3교시에 비어있는 백운관 강의실
final empty = await findEmptyRooms(
  building: '백운관', day: '월', period: 3);
// → ["백운관_132", "백운관_201", "백운관_202", ...]
```

---

## 8. 보안 및 Firestore Rules 권장 설정

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 시간표 데이터: 누구나 읽기 가능, 쓰기는 Admin SDK만
    match /schedules_{yearSemester}/{roomId} {
      allow read: if true;
      allow write: if false;  // Admin SDK(서버)로만 쓰기
    }
  }
}
```

---

## 9. 데이터 갱신 주기 및 운영

| 항목 | 설명 |
|------|------|
| **갱신 주기** | 학기 초 1회 (`npm run etl` → `npm run upload`) |
| **Collection 전환** | 새 학기마다 새 Collection 생성 (예: `schedules_2026_2`) |
| **앱에서의 참조** | Collection 이름을 앱 설정값(Remote Config 등)으로 관리 권장 |
| **원본 보존** | `data/all-2026-10.json` (원본)은 수정하지 않고 보관 |
| **ETL 결과 보존** | `data/etl_result-2026-10.json` (변환 결과)도 검증용 보관 |

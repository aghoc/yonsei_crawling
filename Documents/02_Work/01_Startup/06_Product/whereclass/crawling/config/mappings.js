// ─────────────────────────────────────────────
// 어디수업 — ETL 매핑 사전 (config/mappings.js)
// ─────────────────────────────────────────────

/**
 * Rule 2.1 — 건물명 매핑 사전
 * 포탈 축약어 → 앱 표시 풀네임
 * 
 * 매칭 우선순위: 긴 접두어부터 매칭 (예: "컨B" → "컨" 보다 먼저)
 * 이를 위해 키 길이 역순 정렬 배열도 함께 export
 */
export const BUILDING_MAP = {
  '백':       '백운관',
  '청':       '청송관',
  '정':       '정의관',
  '창':       '창조관',
  '미':       '미래관',
  '컨B':      '컨버젼스홀',   // "컨B109" 등 — "컨" 보다 먼저 매칭해야 함
  '컨':       '컨버젼스홀',
  '연플':     '연세플라자',
  '벤처센터': '산학관',     // 레거시 명칭 — 포탈에서 "벤처센터316"과 "산316"을 혼용 (실제 동일 건물)
  '스':       '스포츠센터',
  '산':       '산학관',
  '인력개발원': '인력개발원',
};

/**
 * 접두어 매칭 시 긴 것부터 우선 비교하기 위한 정렬된 키 배열
 */
export const BUILDING_PREFIXES = Object.keys(BUILDING_MAP)
  .sort((a, b) => b.length - a.length);


/**
 * Rule 2.2 — 교시별 시작 / 종료 시간 매핑 사전
 * 연세대학교 미래캠퍼스 시간표 기준
 * 
 * 교시(period) → { startTime, endTime }
 */
export const PERIOD_MAP = {
  '-1': { startTime: '07:00', endTime: '07:50' },   // 특수교시
  0:    { startTime: '08:00', endTime: '08:50' },
  1:    { startTime: '09:00', endTime: '09:50' },
  2:    { startTime: '10:00', endTime: '10:50' },
  3:    { startTime: '11:00', endTime: '11:50' },
  4:    { startTime: '12:00', endTime: '12:50' },
  5:    { startTime: '13:00', endTime: '13:50' },
  6:    { startTime: '14:00', endTime: '14:50' },
  7:    { startTime: '15:00', endTime: '15:50' },
  8:    { startTime: '16:00', endTime: '16:50' },
  9:    { startTime: '17:00', endTime: '17:50' },
  10:   { startTime: '18:00', endTime: '18:50' },
  11:   { startTime: '19:00', endTime: '19:50' },   // 야간
  12:   { startTime: '20:00', endTime: '20:50' },
  13:   { startTime: '21:00', endTime: '21:50' },
  14:   { startTime: '22:00', endTime: '22:50' },
  15:   { startTime: '23:00', endTime: '23:50' },
};

/**
 * 요일 한글 ↔ 유효성 검증용
 */
export const VALID_DAYS = ['월', '화', '수', '목', '금', '토', '일'];


/**
 * 필터링 대상이 되는 제외 키워드
 * lecrmNm에 이 키워드가 포함되면 물리적 강의실이 아니므로 드롭
 */
export const EXCLUDE_ROOM_KEYWORDS = [
  '동영상',
  '실시간온라인',
  'Maker Space',
];

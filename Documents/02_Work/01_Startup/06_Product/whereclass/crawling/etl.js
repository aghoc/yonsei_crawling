// ─────────────────────────────────────────────
// 어디수업 — ETL 파이프라인 (etl.js)
// Extract → Transform → Load (JSON 출력)
// ─────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import {
  BUILDING_MAP,
  BUILDING_PREFIXES,
  PERIOD_MAP,
  VALID_DAYS,
  EXCLUDE_ROOM_KEYWORDS,
} from './config/mappings.js';

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────
const YEAR     = process.env.YEAR     || new Date().getFullYear().toString();
const SEMESTER = process.env.SEMESTER || (new Date().getMonth() < 7 ? '10' : '20');
const INPUT_FILE  = `./data/all-${YEAR}-${SEMESTER}.json`;
const OUTPUT_FILE = `./data/etl_result-${YEAR}-${SEMESTER}.json`;

// ─────────────────────────────────────────────
// 1. 강의실명 파싱 — Rule 2.1
// ─────────────────────────────────────────────

/**
 * 강의실 원본 문자열에서 물리적 강의실 토큰을 추출한다.
 * 슬래시('/')로 구분된 복합 강의실은 첫 번째 물리 강의실만 사용.
 * 
 * "백121"           → "백121"
 * "정238/동영상(…)" → "정238"
 * "동영상(…)/청405" → "청405"
 * "(미112)"         → "미112"
 * 
 * @param {string} raw - lecrmNm 원본
 * @returns {string|null} 물리 강의실 토큰, 없으면 null
 */
function extractPhysicalRoom(raw) {
  // 슬래시로 분리
  const parts = raw.split('/');

  for (const part of parts) {
    const cleaned = part.trim();
    // 제외 키워드 확인
    if (EXCLUDE_ROOM_KEYWORDS.some(kw => cleaned.includes(kw))) continue;
    // 빈 문자열 건너뛰기
    if (!cleaned) continue;
    return cleaned;
  }
  return null;  // 모든 토큰이 비물리적 → 드롭 대상
}


/**
 * 물리 강의실 토큰을 파싱하여 { building, room, docId } 를 반환한다.
 * 
 * "백121"          → { building: "백운관", room: "121",       docId: "백운관_121" }
 * "(미112)"        → { building: "미래관", room: "112",       docId: "미래관_112" }
 * "대강당(원주)"   → { building: "대강당", room: null,        docId: "대강당" }
 * "인력개발원 211" → { building: "인력개발원", room: "211",   docId: "인력개발원_211" }
 * "벤처센터403-2"  → { building: "벤처센터", room: "403-2",   docId: "벤처센터_403-2" }
 * "(백321)백321"   → { building: "백운관", room: "321",       docId: "백운관_321" }
 * 
 * @param {string} token - 물리 강의실 토큰
 * @returns {{ building: string, room: string|null, docId: string } | null}
 */
function parseRoom(token) {
  let cleaned;

  if (token.startsWith('(')) {
    // 1a) 선행 괄호 토큰: "(미112)" → "미112", "(백321)백321" → "백321"
    cleaned = token.replace(/^\(/, '').replace(/\).*$/, '').trim();
  } else {
    // 1b) 중간/후행 괄호 제거: "백121(백121)" → "백121", "대강당(원주)" → "대강당"
    cleaned = token.replace(/\([^)]*\)/g, '').trim();
  }

  // 2) 공백이 포함된 패턴 (예: "인력개발원 211")
  const spaceMatch = cleaned.match(/^([가-힣A-Za-z]+)\s+(\d[\d\-]*)$/);
  if (spaceMatch) {
    const prefix = spaceMatch[1];
    const room = spaceMatch[2];
    const building = BUILDING_MAP[prefix] || prefix;
    return { building, room, docId: `${building}_${room}` };
  }

  // 3) 접두어 매칭 (긴 것부터)
  for (const prefix of BUILDING_PREFIXES) {
    if (cleaned.startsWith(prefix)) {
      const rest = cleaned.slice(prefix.length);
      const building = BUILDING_MAP[prefix];

      if (rest) {
        // 호실 부분에서 숫자-하이픈 추출
        const roomMatch = rest.match(/^(\d[\d\-]*)$/);
        if (roomMatch) {
          return { building, room: roomMatch[1], docId: `${building}_${roomMatch[1]}` };
        }
        // 매칭 안 되면 rest 전체를 room으로
        return { building, room: rest, docId: `${building}_${rest}` };
      } else {
        // 호실 없이 건물명만
        return { building, room: null, docId: building };
      }
    }
  }

  // 4) 특수한 풀네임 패턴 (예: "대강당(원주)")
  //    이름만 남기기
  const specialName = cleaned.replace(/\([^)]*\)/, '').trim();
  if (specialName) {
    // 숫자가 포함되어있으면 건물+호실 분리 시도
    const m = specialName.match(/^([가-힣A-Za-z]+?)(\d[\d\-]*)$/);
    if (m) {
      return { building: m[1], room: m[2], docId: `${m[1]}_${m[2]}` };
    }
    return { building: specialName, room: null, docId: specialName };
  }

  return null;
}


// ─────────────────────────────────────────────
// 2. 시간표 파싱 — Rule 2.2
// ─────────────────────────────────────────────

/**
 * 시간표 문자열을 개별 교시 블록 배열로 완전 분할한다.
 * 
 * "수2"       → [{ day:"수", period:2, ... }]
 * "월2,3"     → [{ day:"월", period:2, ... }, { day:"월", period:3, ... }]
 * "화7/화8,9" → [{ day:"화", period:7, ... }, { day:"화", period:8, ... }, { day:"화", period:9, ... }]
 * "월5,6,수7(수8)" → [{ day:"월", period:5 }, { day:"월", period:6 }, { day:"수", period:7 }]
 *   (괄호 내 교시는 실습/부수 시간이므로 기본 시간만 확보; 필요시 포함 가능)
 * 
 * @param {string} raw - lctreTimeNm 원본
 * @returns {Array<{ day: string, period: number, startTime: string, endTime: string }>}
 */
function parseTimeBlocks(raw) {
  const blocks = [];

  // 괄호 부분 제거 (실습/보충 시간) — 기본 대면 시간만 추출
  const withoutParen = raw.replace(/\([^)]*\)/g, '');

  // 슬래시로 나눠서 여러 세그먼트 처리
  const segments = withoutParen.split('/');

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // 세그먼트를 요일별 청크로 나누기
    // 예: "월5,6,수7" → ["월5,6", "수7"]
    //     "화2,3,4"  → ["화2,3,4"]
    const dayChunks = splitByDay(trimmed);

    for (const chunk of dayChunks) {
      const { day, periods } = parseDayChunk(chunk);
      if (!day) continue;

      for (const p of periods) {
        const timeInfo = PERIOD_MAP[p];
        if (timeInfo) {
          blocks.push({
            day,
            period: Number(p),
            startTime: timeInfo.startTime,
            endTime:   timeInfo.endTime,
          });
        }
      }
    }
  }

  return blocks;
}


/**
 * "월5,6,수7,8,목3" 같은 문자열을 요일 단위로 쪼갠다.
 * → ["월5,6", "수7,8", "목3"]
 */
function splitByDay(str) {
  const chunks = [];
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (VALID_DAYS.includes(char)) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      current = char;
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}


/**
 * "월5,6" → { day: "월", periods: [5, 6] }
 * "수7"   → { day: "수", periods: [7] }
 * "월-1"  → { day: "월", periods: [-1] }
 */
function parseDayChunk(chunk) {
  if (!chunk || chunk.length < 2) return { day: null, periods: [] };

  const day = chunk[0];
  if (!VALID_DAYS.includes(day)) return { day: null, periods: [] };

  const rest = chunk.slice(1); // "5,6" or "7" or "-1"

  // 콤마로 분리 후 숫자 파싱
  const periods = rest
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '' && !isNaN(Number(s)))
    .map(Number);

  return { day, periods };
}


// ─────────────────────────────────────────────
// 3. 메인 ETL 파이프라인
// ─────────────────────────────────────────────
function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   어디수업 — ETL Transform Pipeline      ║');
  console.log('╚══════════════════════════════════════════╝');

  // ── Extract ──
  const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`\n📥 원본 로드: ${rawData.length}건 (${INPUT_FILE})`);

  // ── Transform ──
  const stats = {
    total: rawData.length,
    droppedNoRoom: 0,
    droppedNoTime: 0,
    droppedNonPhysical: 0,
    droppedParseError: 0,
    processed: 0,
    totalBlocks: 0,
  };

  /** @type {Map<string, { building: string, room: string|null, classes: Array }>} */
  const roomMap = new Map();

  for (const row of rawData) {
    // 3.1 필터링: null 강의실 드롭
    if (!row.lecrmNm || row.lecrmNm.trim() === '') {
      stats.droppedNoRoom++;
      continue;
    }

    // 3.2 필터링: null 시간 드롭
    if (!row.lctreTimeNm || row.lctreTimeNm.trim() === '') {
      stats.droppedNoTime++;
      continue;
    }

    // 3.3 강의실 파싱 (Rule 2.1)
    const physicalRoom = extractPhysicalRoom(row.lecrmNm);
    if (!physicalRoom) {
      stats.droppedNonPhysical++;
      continue;
    }

    const roomInfo = parseRoom(physicalRoom);
    if (!roomInfo) {
      stats.droppedParseError++;
      continue;
    }

    // 3.4 시간표 파싱 (Rule 2.2)
    const timeBlocks = parseTimeBlocks(row.lctreTimeNm);
    if (timeBlocks.length === 0) {
      stats.droppedParseError++;
      continue;
    }

    // 3.5 속성 리네이밍 (Rule 2.3) + 블록 생성
    const className  = row.subjtNm2 || row.subjtNm || '';
    const professor  = row.cgprfNm || '';

    for (const block of timeBlocks) {
      const classItem = {
        className,
        professor,
        day:       block.day,
        period:    block.period,
        startTime: block.startTime,
        endTime:   block.endTime,
      };

      // 3.6 인메모리 그룹화 (Rule 4.1)
      if (!roomMap.has(roomInfo.docId)) {
        roomMap.set(roomInfo.docId, {
          building: roomInfo.building,
          room:     roomInfo.room ? `${roomInfo.room}호` : null,
          classes:  [],
        });
      }
      roomMap.get(roomInfo.docId).classes.push(classItem);
      stats.totalBlocks++;
    }

    stats.processed++;
  }

  // ── 결과물 구성 ──
  const result = {};
  for (const [docId, doc] of roomMap) {
    // classes를 요일 → 교시 순 정렬
    doc.classes.sort((a, b) => {
      const dayOrder = VALID_DAYS.indexOf(a.day) - VALID_DAYS.indexOf(b.day);
      if (dayOrder !== 0) return dayOrder;
      return a.period - b.period;
    });
    result[docId] = doc;
  }

  // ── 저장 ──
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');

  const fileStat = fs.statSync(OUTPUT_FILE);
  const fileSizeMB = (fileStat.size / 1024 / 1024).toFixed(2);

  // ── 리포트 ──
  console.log('\n══════════════════════════════════════════');
  console.log('  📊 ETL Transform 결과 리포트');
  console.log('══════════════════════════════════════════');
  console.log(`  원본 수업 수:           ${stats.total}건`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  강의실 null 드롭:       ${stats.droppedNoRoom}건`);
  console.log(`  시간표 null 드롭:       ${stats.droppedNoTime}건`);
  console.log(`  비물리 강의실 드롭:     ${stats.droppedNonPhysical}건`);
  console.log(`  파싱 에러 드롭:         ${stats.droppedParseError}건`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  처리 완료 수업 수:      ${stats.processed}건`);
  console.log(`  생성된 시간블록 수:     ${stats.totalBlocks}블록`);
  console.log(`  고유 강의실(Document):  ${roomMap.size}개`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  출력 파일:              ${OUTPUT_FILE}`);
  console.log(`  출력 파일 크기:         ${fileSizeMB} MB`);
  console.log('══════════════════════════════════════════\n');

  // 상위 10개 강의실 (블록 수 기준)
  const topRooms = [...roomMap.entries()]
    .sort((a, b) => b[1].classes.length - a[1].classes.length)
    .slice(0, 10);

  console.log('  🏫 시간블록 수 상위 10개 강의실:');
  topRooms.forEach(([docId, doc], i) => {
    console.log(`    ${i + 1}. ${docId}: ${doc.classes.length}블록`);
  });

  console.log('\n✅ ETL Transform 완료!\n');
}

main();

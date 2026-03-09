// ─────────────────────────────────────────────
// 어디수업 — 통합 파이프라인 (pipeline.js)
// 크롤링 → ETL → 검증 → Firebase 업로드를 한 번에 실행
// ─────────────────────────────────────────────
// 사용법:
//   node pipeline.js                  ← 자동 학기 계산
//   YEAR=2026 SEMESTER=10 node pipeline.js  ← 환경변수 지정
// ─────────────────────────────────────────────
import { execFileSync } from 'child_process';
import fs from 'fs';

// ── 학년도/학기 결정 ──
const YEAR     = process.env.YEAR     || new Date().getFullYear().toString();
const SEMESTER = process.env.SEMESTER || (new Date().getMonth() < 7 ? '10' : '20');
const SEMESTER_LABEL = SEMESTER === '10' ? '1학기' : '2학기';

// ── 파일 경로 ──
const RAW_FILE = `./data/all-${YEAR}-${SEMESTER}.json`;
const ETL_FILE = `./data/etl_result-${YEAR}-${SEMESTER}.json`;

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║   어디수업 — 통합 파이프라인 (Pipeline)       ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`  대상: ${YEAR}학년도 ${SEMESTER_LABEL} (코드: ${SEMESTER})`);
console.log('');

const startTime = Date.now();

// ── 환경변수 전달 ──
const env = { ...process.env, YEAR, SEMESTER };

// ─────────────────────────────────────────────
// Step 1: 크롤링
// ─────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  📡 Step 1/3 — 크롤링 (crawler.js)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

try {
  execFileSync('node', ['crawler.js'], { env, stdio: 'inherit', cwd: process.cwd() });
} catch (err) {
  console.error('\n✖ 크롤링 실패! 파이프라인을 중단합니다.');
  process.exit(1);
}

// 크롤링 결과 파일 확인
if (!fs.existsSync(RAW_FILE)) {
  console.error(`\n✖ 크롤링 결과 파일이 생성되지 않았습니다: ${RAW_FILE}`);
  process.exit(1);
}
const rawCount = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8')).length;
console.log(`\n  ✔ 크롤링 완료: ${rawCount}건 → ${RAW_FILE}\n`);

// ─────────────────────────────────────────────
// Step 2: ETL Transform
// ─────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🔄 Step 2/3 — ETL Transform (etl.js)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

try {
  execFileSync('node', ['etl.js'], { env, stdio: 'inherit', cwd: process.cwd() });
} catch (err) {
  console.error('\n✖ ETL 변환 실패! 파이프라인을 중단합니다.');
  process.exit(1);
}

// ── ETL 결과 검증 게이트 ──
if (!fs.existsSync(ETL_FILE)) {
  console.error(`\n✖ ETL 결과 파일이 생성되지 않았습니다: ${ETL_FILE}`);
  process.exit(1);
}

const etlData = JSON.parse(fs.readFileSync(ETL_FILE, 'utf8'));
const validationErrors = validateETLResult(etlData);

if (validationErrors.length > 0) {
  console.error('\n✖ ETL 결과 검증 실패:');
  validationErrors.forEach(e => console.error(`  - ${e}`));
  console.error('\n  업로드를 중단합니다. 데이터를 확인하세요.');
  process.exit(1);
}

const docCount = Object.keys(etlData).length;
console.log(`\n  ✔ 검증 통과: ${docCount}개 Document, 스키마 이상 없음\n`);

// ─────────────────────────────────────────────
// Step 3: Firebase 업로드
// ─────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  📤 Step 3/3 — Firebase Upload (upload.js)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

try {
  execFileSync('node', ['upload.js'], { env, stdio: 'inherit', cwd: process.cwd() });
} catch (err) {
  console.error('\n✖ Firebase 업로드 실패!');
  process.exit(1);
}

// ─────────────────────────────────────────────
// 최종 리포트
// ─────────────────────────────────────────────
const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║          🎉 파이프라인 전체 완료!             ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`  대상:          ${YEAR}학년도 ${SEMESTER_LABEL}`);
console.log(`  크롤링 원본:   ${rawCount}건 (${RAW_FILE})`);
console.log(`  변환 결과:     ${docCount}개 Document (${ETL_FILE})`);
console.log(`  Firestore:     schedules_2026_1 컬렉션 업로드 완료`);
console.log(`  총 소요 시간:  ${totalElapsed}초`);
console.log('');


// ─────────────────────────────────────────────
// 검증 함수
// ─────────────────────────────────────────────
function validateETLResult(data) {
  const docs = Object.keys(data);
  const errors = [];

  if (docs.length < 50) {
    errors.push(`Document 수가 너무 적음: ${docs.length}개 (최소 50개 이상 예상)`);
  }
  if (docs.length > 500) {
    errors.push(`Document 수가 비정상적으로 많음: ${docs.length}개`);
  }

  let totalBlocks = 0;
  for (const id of docs) {
    const d = data[id];
    if (!d.building) errors.push(`${id}: building 필드 누락`);
    if (!Array.isArray(d.classes)) {
      errors.push(`${id}: classes가 배열이 아님`);
      continue;
    }
    if (d.classes.length === 0) errors.push(`${id}: classes 배열이 비어있음`);
    totalBlocks += d.classes.length;

    // 개별 블록 스키마 검증 (첫 3개만 샘플)
    for (const c of d.classes.slice(0, 3)) {
      if (!c.className) errors.push(`${id}: className 누락`);
      if (!c.day) errors.push(`${id}: day 누락`);
      if (c.period === undefined) errors.push(`${id}: period 누락`);
      if (!c.startTime) errors.push(`${id}: startTime 누락`);
      if (!c.endTime) errors.push(`${id}: endTime 누락`);
    }
  }

  if (totalBlocks < 500) {
    errors.push(`총 블록 수가 너무 적음: ${totalBlocks}개 (최소 500개 이상 예상)`);
  }

  return errors;
}

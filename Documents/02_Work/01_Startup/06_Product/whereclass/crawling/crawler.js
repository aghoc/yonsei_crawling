import axios from 'axios';
import fs from 'fs';
import qs from 'qs';
import path from 'path';

// ─────────────────────────────────────────────
// 설정값 (Config)
// ─────────────────────────────────────────────
const BASE_URL = 'https://underwood1.yonsei.ac.kr';
const META_ENDPOINT = '/sch/sles/SlescsCtr/findSchSlesHandbList.do';   // Phase 1 & 2
const DATA_ENDPOINT = '/sch/sles/SlessyCtr/findAtnlcHandbList.do';    // Phase 3

const YEAR     = process.env.YEAR     || new Date().getFullYear().toString();
const SEMESTER = process.env.SEMESTER || (new Date().getMonth() < 7 ? '10' : '20');
// SEMESTER: '10' = 1학기(봄), '20' = 2학기(가을)  — 포탈 내부 코드
const CAMPUS_CODE = 's2';     // 미래캠퍼스
const DELAY_MS = 1200;        // Rate-limit: 호출 간 최소 지연 (ms)
const MAX_RETRIES = 3;        // 실패 시 재시도 횟수

// 공통 고정 파라미터 (메타 + 하위 파라미터 가변)
const COMMON_META_PARAMS = {
  _menuId: 'MTA5MzM2MTI3MjkzMTI2NzYwMDA=',
  _menuNm: '',
  _pgmId: 'NDE0MDA4NTU1NjY=',
  '@d1#level': 'B',
  '@d1#lv1': CAMPUS_CODE,
  '@d1#lv3': '%',
  '@d1#sysinstDivCd': '%',
  '@d1#univGbn': 'A',
  '@d1#findAuthGbn': '8',
  '@d1#syy': YEAR,
  '@d1#smtDivCd': SEMESTER,
  '@d#': '@d1#',
  '@d1#': 'dmCond',
  '@d1#tp': 'dm'
};

// ─────────────────────────────────────────────
// Axios 클라이언트 (세션 쿠키 자동 유지)
// ─────────────────────────────────────────────
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/com/lgin/SsoCtr/initExtPageWork.do?link=handbList&locale=ko`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
  },
  responseType: 'text',
  withCredentials: true,
  timeout: 30000
});

// ─────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────

/** ms만큼 대기 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 디렉터리가 없으면 생성 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** POST 요청 + JSON 파싱 (재시도 포함) */
async function postFormJSON(endpoint, formObj, retries = MAX_RETRIES) {
  const body = qs.stringify(formObj);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await client.post(endpoint, body);
      const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return JSON.parse(raw);
    } catch (err) {
      const status = err.response?.status || 'N/A';
      console.warn(`  ⚠ 요청 실패 (시도 ${attempt}/${retries}) [status=${status}]: ${err.message}`);
      if (attempt < retries) {
        const backoff = DELAY_MS * attempt;
        console.warn(`    → ${backoff}ms 후 재시도...`);
        await sleep(backoff);
      } else {
        console.error(`  ✖ 최종 실패: ${endpoint}`);
        return null;
      }
    }
  }
}

/** 현재 시각 문자열 */
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// ─────────────────────────────────────────────
// Phase 1: 대학(원)분류 목록 수집
// ─────────────────────────────────────────────
async function fetchUnivList() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Phase 1: 대학(원)분류 목록 수집');
  console.log('══════════════════════════════════════════');

  const form = {
    ...COMMON_META_PARAMS,
    '@d1#dsNm': 'dsUnivCd',
    '@d1#lv2': '%'  // 전체
  };

  const data = await postFormJSON(META_ENDPOINT, form);
  if (!data || !Array.isArray(data.dsUnivCd)) {
    console.error('✖ Phase 1 응답에서 dsUnivCd 배열을 찾을 수 없습니다.');
    if (data) {
      fs.writeFileSync('./data/phase1_raw.json', JSON.stringify(data, null, 2), 'utf8');
      console.error('  원본 응답 → ./data/phase1_raw.json');
    }
    return [];
  }

  const univList = data.dsUnivCd;
  console.log(`  ✔ 대학분류 ${univList.length}건 확보`);
  univList.forEach(u => console.log(`    - [${u.deptCd}] ${u.deptNm}`));

  // 중간 결과 저장
  fs.writeFileSync('./data/phase1_univ_list.json', JSON.stringify(univList, null, 2), 'utf8');
  return univList;
}

// ─────────────────────────────────────────────
// Phase 2: 개설학과 목록 수집 (Nested Loop)
// ─────────────────────────────────────────────
async function fetchDeptListForAllUnivs(univList) {
  console.log('\n══════════════════════════════════════════');
  console.log('  Phase 2: 개설학과 목록 수집 (2-Depth)');
  console.log('══════════════════════════════════════════');

  /** @type {Array<{univCd: string, univNm: string, deptCd: string, deptNm: string}>} */
  const allDepts = [];

  for (let i = 0; i < univList.length; i++) {
    const univ = univList[i];
    console.log(`\n  [${i + 1}/${univList.length}] ${univ.deptNm} (${univ.deptCd})`);

    const form = {
      ...COMMON_META_PARAMS,
      '@d1#dsNm': 'dsFaclyCd',
      '@d1#lv2': univ.deptCd
    };

    const data = await postFormJSON(META_ENDPOINT, form);

    // ── 빈 배열 / 키 누락 방어 ──
    if (!data || !Array.isArray(data.dsFaclyCd) || data.dsFaclyCd.length === 0) {
      console.log('    → 하위 학과 없음 (Empty). Skip.');
      await sleep(DELAY_MS);
      continue;
    }

    const depts = data.dsFaclyCd;
    console.log(`    ✔ 학과 ${depts.length}건`);
    depts.forEach(d => {
      allDepts.push({
        univCd: univ.deptCd,
        univNm: univ.deptNm,
        deptCd: d.deptCd,
        deptNm: d.deptNm
      });
    });

    // Rate-limit
    await sleep(DELAY_MS);
  }

  console.log(`\n  ═══ Phase 2 합산: 전체 학과 ${allDepts.length}건 확보 ═══`);
  fs.writeFileSync('./data/phase2_dept_list.json', JSON.stringify(allDepts, null, 2), 'utf8');
  return allDepts;
}

// ─────────────────────────────────────────────
// Phase 3: 학과별 수업 데이터 수집
// ─────────────────────────────────────────────
async function fetchCoursesForAllDepts(deptList) {
  console.log('\n══════════════════════════════════════════');
  console.log('  Phase 3: 수업 데이터 수집 (Target)');
  console.log('══════════════════════════════════════════');

  const allCourses = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < deptList.length; i++) {
    const dept = deptList[i];
    console.log(`\n  [${i + 1}/${deptList.length}] ${dept.univNm} > ${dept.deptNm} (${dept.deptCd})`);

    // Phase 3 Payload: 기존 cURL.md에서 역공학한 파라미터 구조
    const form = {
      _menuId: 'MTA5MzM2MTI3MjkzMTI2NzYwMDA=',
      _menuNm: '',
      _pgmId: 'NDE0MDA4NTU1NjY=',
      '@d1#syy': YEAR,
      '@d1#smtDivCd': SEMESTER,
      '@d1#campsBusnsCd': CAMPUS_CODE,
      '@d1#univCd': dept.univCd,       // ← Phase 1에서 획득한 대학 코드
      '@d1#faclyCd': dept.deptCd,      // ← Phase 2에서 획득한 학과 코드
      '@d1#hy': '',
      '@d1#cdt': '%',
      '@d1#kwdDivCd': '1',
      '@d1#searchGbn': '1',
      '@d1#kwd': '',
      '@d1#allKwd': '',
      '@d1#engChg': '',
      '@d1#prnGbn': 'false',
      '@d1#lang': '',
      '@d1#campsDivCd': '',
      '@d1#stuno': '',
      '@d#': '@d1#',
      '@d1#': 'dmCond',
      '@d1#tp': 'dm'
    };

    const data = await postFormJSON(DATA_ENDPOINT, form);

    if (!data) {
      console.log('    ✖ 응답 실패 (null)');
      failCount++;
      await sleep(DELAY_MS);
      continue;
    }

    // 응답 JSON에서 수업 데이터 배열 키 탐색 (서버 응답 구조에 따라 유동적)
    let courses = [];
    const dataKeys = Object.keys(data);
    for (const key of dataKeys) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        courses = data[key];
        break;
      }
    }

    if (courses.length === 0) {
      console.log('    → 수업 데이터 0건');
    } else {
      console.log(`    ✔ 수업 ${courses.length}건 수집`);
      if (courses.length >= 200) {
        console.warn('    ⚠ 200건 상한 도달 — 일부 데이터 누락 가능!');
      }
    }

    // 원본 소속 정보 태그 부착
    courses.forEach(c => {
      c._univCd = dept.univCd;
      c._univNm = dept.univNm;
      c._deptCd = dept.deptCd;
      c._deptNm = dept.deptNm;
    });

    allCourses.push(...courses);
    successCount++;

    // Rate-limit
    await sleep(DELAY_MS);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Phase 3 완료: 총 ${allCourses.length}건 수집`);
  console.log(`  성공 ${successCount} / 실패 ${failCount} / 전체 ${deptList.length}`);
  console.log('══════════════════════════════════════════');

  return allCourses;
}

// ─────────────────────────────────────────────
// 중복 제거 (Deduplication)
// ─────────────────────────────────────────────
function deduplicateCourses(courses) {
  const seen = new Set();
  const unique = [];
  for (const c of courses) {
    // 고유 키: 과목코드(subjtnb) + 강의분반(corseDvclsNo) + 실습분반(prctsCorseDvclsNo)
    const key = `${c.subjtnb || ''}_${c.corseDvclsNo || ''}_${c.prctsCorseDvclsNo || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  console.log(`  중복 제거: ${courses.length} → ${unique.length} (${courses.length - unique.length}건 중복)`);
  return unique;
}

// ─────────────────────────────────────────────
// 메인 파이프라인
// ─────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   어디수업 — 수강편람 동적 크롤러 v2.0   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  학년도: ${YEAR}  |  학기: ${SEMESTER}  |  캠퍼스: ${CAMPUS_CODE}`);
  console.log(`  Rate-limit: ${DELAY_MS}ms  |  최대 재시도: ${MAX_RETRIES}회`);

  ensureDir('./data');

  // ── Phase 1 ──
  const univList = await fetchUnivList();
  if (univList.length === 0) {
    console.error('\n✖ Phase 1에서 대학 목록을 가져오지 못했습니다. 종료합니다.');
    process.exit(1);
  }

  // ── Phase 2 ──
  const deptList = await fetchDeptListForAllUnivs(univList);
  if (deptList.length === 0) {
    console.error('\n✖ Phase 2에서 학과 목록을 가져오지 못했습니다. 종료합니다.');
    process.exit(1);
  }

  // ── Phase 3 ──
  const rawCourses = await fetchCoursesForAllDepts(deptList);

  // ── 중복 제거 & 저장 ──
  const courses = deduplicateCourses(rawCourses);

  const outFileName = `all-${YEAR}-${SEMESTER}.json`;
  const outPath = `./data/${outFileName}`;
  fs.writeFileSync(outPath, JSON.stringify(courses, null, 2), 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 최종 결과: ${courses.length}건 → ${outPath}`);
  console.log(`⏱  소요 시간: ${elapsed}초`);
}

// ─────────────────────────────────────────────
// CLI 분기
// ─────────────────────────────────────────────
const cmd = process.argv[2];

if (cmd === 'phase1') {
  // Phase 1만 단독 실행
  ensureDir('./data');
  fetchUnivList().then(() => process.exit(0));
} else if (cmd === 'phase2') {
  // Phase 1 + 2 실행 (학과 목록까지)
  ensureDir('./data');
  fetchUnivList()
    .then(univs => fetchDeptListForAllUnivs(univs))
    .then(() => process.exit(0));
} else {
  // 전체 파이프라인 (기본)
  main().then(() => process.exit(0)).catch(err => {
    console.error('치명적 오류:', err);
    process.exit(1);
  });
}

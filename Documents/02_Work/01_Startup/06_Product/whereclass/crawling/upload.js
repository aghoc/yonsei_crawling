// ─────────────────────────────────────────────
// 어디수업 — Firebase Firestore 적재 (upload.js)
// Phase 3: ETL 결과물 → Firestore Batch Write
// ─────────────────────────────────────────────
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────
const YEAR     = process.env.YEAR     || new Date().getFullYear().toString();
const SEMESTER = process.env.SEMESTER || (new Date().getMonth() < 7 ? '10' : '20');
const ETL_RESULT_FILE = `./data/etl_result-${YEAR}-${SEMESTER}.json`;
const COLLECTION_NAME = 'schedules_2026_1';   // 앱 클라이언트 하드코딩 — 변경 금지
const BATCH_LIMIT     = 500;   // Firestore Batch Write 한도

// ─────────────────────────────────────────────
// Firebase 초기화
// ─────────────────────────────────────────────

/**
 * 서비스 계정 키 파일 경로를 결정한다.
 * 1) 환경변수 GOOGLE_APPLICATION_CREDENTIALS
 * 2) ./config/serviceAccountKey.json (기본 경로)
 */
function getServiceAccountPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const defaultPath = './config/serviceAccountKey.json';
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  console.error('✖ Firebase 서비스 계정 키를 찾을 수 없습니다.');
  console.error('  다음 중 하나를 설정하세요:');
  console.error('  1) 환경변수: GOOGLE_APPLICATION_CREDENTIALS=<경로>');
  console.error('  2) 파일:     ./config/serviceAccountKey.json');
  process.exit(1);
}

function initFirebase() {
  const keyPath = getServiceAccountPath();
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

  initializeApp({
    credential: cert(serviceAccount),
  });

  console.log(`  ✔ Firebase 초기화 완료 (프로젝트: ${serviceAccount.project_id})`);
  return getFirestore();
}

// ─────────────────────────────────────────────
// Batch Write 실행
// ─────────────────────────────────────────────
async function uploadToFirestore(db, data) {
  const docIds = Object.keys(data);
  const totalDocs = docIds.length;
  let uploadedCount = 0;
  let batchCount = 0;

  console.log(`\n  📤 ${totalDocs}개 Document → "${COLLECTION_NAME}" 컬렉션 업로드 시작`);
  console.log(`  Batch 한도: ${BATCH_LIMIT}개씩 묶어서 커밋\n`);

  // Batch 단위로 쪼개기
  for (let i = 0; i < totalDocs; i += BATCH_LIMIT) {
    const chunk = docIds.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();

    for (const docId of chunk) {
      const docRef = db.collection(COLLECTION_NAME).doc(docId);
      batch.set(docRef, data[docId]);
    }

    try {
      await batch.commit();
      uploadedCount += chunk.length;
      batchCount++;
      console.log(`    Batch #${batchCount}: ${chunk.length}개 커밋 완료 (누적: ${uploadedCount}/${totalDocs})`);
    } catch (err) {
      console.error(`    ✖ Batch #${batchCount + 1} 커밋 실패:`, err.message);
      console.error(`    → 실패 범위: ${chunk[0]} ~ ${chunk[chunk.length - 1]}`);
      // 실패해도 다음 배치 계속 진행
    }
  }

  return { uploadedCount, batchCount };
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  const startTime = Date.now();

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   어디수업 — Firebase Firestore Upload   ║');
  console.log('╚══════════════════════════════════════════╝');

  // 1) ETL 결과물 로드
  if (!fs.existsSync(ETL_RESULT_FILE)) {
    console.error(`\n✖ ETL 결과 파일이 없습니다: ${ETL_RESULT_FILE}`);
    console.error('  먼저 ETL 파이프라인을 실행하세요: npm run etl');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(ETL_RESULT_FILE, 'utf8'));
  const docCount = Object.keys(data).length;
  console.log(`\n  📥 ETL 결과 로드: ${docCount}개 Document (${ETL_RESULT_FILE})`);

  // 2) Firebase 초기화
  const db = initFirebase();

  // 3) 업로드 실행
  const { uploadedCount, batchCount } = await uploadToFirestore(db, data);

  // 4) 결과 리포트
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n══════════════════════════════════════════');
  console.log('  📊 업로드 결과 리포트');
  console.log('══════════════════════════════════════════');
  console.log(`  대상 컬렉션:   ${COLLECTION_NAME}`);
  console.log(`  총 Document:   ${docCount}개`);
  console.log(`  업로드 성공:   ${uploadedCount}개`);
  console.log(`  Batch 횟수:    ${batchCount}회`);
  console.log(`  소요 시간:     ${elapsed}초`);
  console.log('══════════════════════════════════════════\n');

  if (uploadedCount === docCount) {
    console.log('✅ Firebase Firestore 적재 완료!\n');
  } else {
    console.warn(`⚠ 일부 Document 업로드 실패: ${docCount - uploadedCount}건\n`);
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});

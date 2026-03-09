**진행 상황**
- **요약**: 사이트의 조회 API를 분석하여 실제 엔드포인트와 cURL을 확보했습니다. 서버는 한 요청당 최대 200개 항목으로 잘라 반환합니다.

**완료된 항목**
- **엔드포인트 확인**: 브라우저에서 복사한 cURL로 실제 요청 확인 완료.
- **응답 형식 파악**: 응답이 JSON 형식임을 확인했고, `data/response.json`으로 저장됨.
- **드롭다운 매핑 수집**: `data/options_mapping.json` 생성(학과 목록 및 `deptCd` 확보).
- **기본 크롤러 스켈레톤 작성**: `package.json`, `crawler.js`, `README.md` 추가. `crawler.js`는 응답을 JSON으로 자동 저장하도록 수정됨.

**현재 저장된 주요 파일**
- **`data/options_mapping.json`**: 학과별 `deptCd` 목록
- **`data/response.json`**: 단일 쿼리 응답(항목 수: 200)
- **`crawler.js`**, **`package.json`**, **`README.md`**

**문제/제약**
- **서버 제한**: API가 한 응답에 200개로 제한(페이징 메타 없음). 한 번의 요청으로 전체를 받을 수 없음.

**다음으로 할 일(우선순위 순)**
- **1) 전체 수집 구현**: `options_mapping.json`의 `deptCd`를 순회하며 각 `deptCd`로 POST 요청을 반복해 결과 병합(중복 제거 포함).
- **2) 페이징/추가 파라미터 탐색**: 브라우저 Network에서 페이지 전환 시 파라미터가 있는지 확인하면 더 효율적 페이징 적용 가능.
- **3) 안정화**: 재시도, 지연(레이트 제한 회피), 에러 로깅 추가.
- **4) 자동화(선택)**: 정상 수집 확인 후 GitHub Actions로 스케줄링.

**즉시 실행 방법**
```bash
cd crawling
npm install
npm start            # 단일 예제 요청 저장
node crawler.js fetch-options   # 드롭다운(옵션) 갱신
```

**다음 단계에서 제가 바로 해드릴 수 있는 것**
- `crawler.js`에 `deptCd` 기반 반복 수집(병합/중복제거/재시도 포함) 기능 추가하여 `data/all-{year}-{term}.json` 생성.
- 원하시면 바로 구현하겠습니다.


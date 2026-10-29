# 킨카라멘 웨이팅 예측

전체 웨이팅 수, 내 순서, 원하는 입장시간을 입력하면 입장시간의 확률분포와 순서 미루기 추천을 보여 주는 한국어 정적 웹앱입니다. React + TypeScript + Vite로 만들었으며 계산은 브라우저 Web Worker에서만 실행합니다.

**실제 캐치테이블과 연동되지 않습니다.** 순서 변경은 사용자가 캐치테이블에서 직접 해야 합니다. 캐치테이블·킨카라멘·토스의 공식 서비스가 아닙니다.

## 빠른 시작

Node.js 22.12 이상을 준비합니다. ZIP을 풀고 프로젝트 폴더에서 실행하세요.

```bash
npm ci
npm run dev
```

터미널에 표시된 주소를 엽니다. 환경변수, API 키, 백엔드, 데이터베이스가 필요하지 않습니다.

```bash
npm test          # 모델·시뮬레이션·추천·제공 데이터 검증
npm run analyze   # 제공된 CSV의 개발용 분석만 출력
npm run build     # TypeScript 검사 후 dist 생성
npm run preview   # 빌드 결과 로컬 확인
```

`index.html`을 파일로 직접 여는 대신 HTTP 서버로 실행해야 ES 모듈과 Web Worker가 정상 작동합니다. `vite preview`는 로컬 검증용이며 운영 서버가 아닙니다.

## 사용법

1. 전체 팀 수(내 팀 포함)와 현재 순서를 입력합니다. 1번째면 앞 팀은 0팀입니다.
2. 오늘의 원하는 입장시간과 허용 차이(±5/10/15분)를 선택합니다.
3. 필요하면 식당 도착 예정시간을 입력합니다. 생략하면 이미 도착했다고 가정합니다.
4. **입장시간 예측하기**를 누릅니다. 현재 시각을 서울 시간으로 읽고 분 단위로 고정합니다.
5. 추천, 현재 순서 평균·80% 예측구간, 5분 단위 확률, 누적 확률을 확인합니다.
6. 아래 순서별 막대를 누르면 원하는 순서의 분포와 비교합니다.

현재 입력이 바뀌면 기존 결과에 재계산 안내가 표시됩니다. 결과는 계산 버튼을 누른 시각 기준입니다. 실제 대기열이 바뀌었다면 다시 입력해야 합니다. 시계를 읽는 것만으로 대기열 상태를 자동 갱신하지 않습니다.

영업시간 밖에는 **실측 시점 예시 보기**로 13:06 / 10팀 / 4번째 기록을 계산할 수 있습니다. 예시 모드가 명시되고, 확률·추천은 동일한 시뮬레이터로 계산됩니다. 실시간으로 돌아가면 예시 결과를 지웁니다.

## 핵심 기능

- 동일 시나리오로 모든 후보 순서를 10,000회 비교하는 이벤트 기반 연속시간 시뮬레이션
- 서비스 호출, 동시 2팀 호출, 앞/뒤 취소, 유효 미루기, 신규 등록, 운영 경계 처리
- 1번째가 된 후의 호출 대기 포함
- 도착시간, 3분 호출 유예 가정, 유예 초과 확률 반영
- 평균, 중앙값, 10/25/75/90% 분위수, 목표 전/구간/후 확률
- 종료까지 미입장·유예 초과 확률을 버리거나 재정규화하지 않음
- 5분 히스토그램 / 누적 차트 / 가로 스크롤 가능한 순서별 비교 / 숫자 표
- 고정 시드, Web Worker, 진행률, 최대 2건의 메모리 캐시, 오래된 응답 차단
- 모바일 우선 반응형, iOS 기본 시간 입력, 안전영역, 키보드 포커스, 모션 감소 설정 존중

## 꼭 알아야 할 모델 한계

관측된 대기열 순감소 간격 **3.44분/팀은 실제 입장 간격이 아닙니다.** 최소 2건의 취소만 명시되어 실제 취소율과 미루기율은 식별할 수 없습니다. 이 앱은 관측과 크게 모순되지 않는 가정을 한 번 정해 모든 사용자에게 동일하게 적용합니다.

**14:30 점심 영업 종료, 호출 유예 3분, 2팀 동시 호출 확률 15%, 미루기율은 확인되지 않은 가정입니다.** 실제 매장 규정이라고 읽으면 안 됩니다. 한 날짜의 집계 기록으로 확률의 실제 정확도를 검증할 수 없습니다. [MODEL.md](MODEL.md)에 계산식·근거·한계를 모두 기록했습니다.

개발 시점 데이터로 계산한 예시(시드 20261029):

| 조건 | 현재 4번째 | 추천 6번째 |
|---|---:|---:|
| 13:06, 전체 10팀, 목표 13:30 ±10분, 이미 도착 | | |
| 평균 입장 | 13:21 | 13:29 |
| 목표 구간 입장확률 | 46.56% | 66.45% |

7번째는 66.35%로 거의 같습니다. 추천 숫자의 미세한 차이를 실제 성능 차이로 단정할 수 없습니다. 위 수치는 문서의 개발 검증 결과이며 UI에 하드코딩되지 않습니다.

## 데이터 처리

런타임에 서버로 보내는 웨이팅 정보, 분석 이벤트, 외부 API 요청이 없습니다. localStorage, 이용 이력, 사용자 데이터베이스, 실제 입장 기록, CSV 업로드/내보내기, 학습·자동 보정 기능을 구현하지 않았습니다. 현재 입력과 예측 캐시는 메모리에만 있고 새로고침하면 사라집니다.

`src/data/historicalWaiting.csv`는 사용자가 제공한 54개 기록의 고정 참고자료입니다. 런타임 번들에서 읽지 않습니다. `npm run analyze`와 테스트에서만 사용합니다. `modelConstants.ts`는 개발자가 검토 후 코드로만 변경할 수 있습니다.

## 프로젝트 구성

```text
src/
  components/    # 입력, 요약, 차트, 순서 비교, 모델 설명
  models/
    modelConstants.ts  # 고정 계수
    waitingModel.ts    # 순수 상태 전이와 사건 발생률
    simulation.ts      # 공통 시나리오 시뮬레이션과 요약
    optimizer.ts       # 목표 구간 성공확률 최대화
  hooks/useWaitingPrediction.ts
  workers/simulation.worker.ts
  data/historicalWaiting.csv
  tests/         # Vitest, 개발 데이터 검증
  utils/         # 시간, 시드 난수, 분위수
  App.tsx
  main.tsx
  styles.css
scripts/
  analyze-data.mjs
  package-source.py
MODEL.md
DESIGN.md
VERIFICATION.md
vercel.json
netlify.toml
```

라이브러리: React 19, Vite 7, Tailwind CSS 4, Radix Collapsible, Lucide React, Recharts 3, Motion for React, date-fns 4, Vitest 3. 실제 설치 버전은 `package-lock.json`으로 고정됩니다. TDS 패키지에 종속되지 않는 독자 UI입니다.

## Vercel 배포

1. 전체 소스를 자신의 GitHub 저장소에 올립니다. `node_modules`, `.env`, `dist`는 올리지 않습니다.
2. Vercel에서 저장소를 가져옵니다.
3. Framework는 **Vite**, Build Command는 **npm run build**, Output Directory는 **dist**로 설정합니다.
4. Node.js는 22 이상을 선택하고 배포합니다. 환경변수는 없습니다.

`vercel.json`이 포함되어 있습니다. 프런트엔드 정적 파일만 배포하며 Serverless Function은 사용하지 않습니다.

## Netlify 배포

Git 연동 시 저장소를 선택하면 `netlify.toml`의 빌드 명령과 출력 폴더를 사용합니다. Build Command `npm run build`, Publish Directory `dist`, Node.js 22 설정입니다.

직접 업로드하려면 로컬에서 `npm ci`와 `npm run build`를 실행한 뒤 생성된 **dist 폴더**를 Netlify에 업로드합니다. 원본 프로젝트 폴더를 업로드하는 것이 아닙니다.

별도 URL 라우팅이 없는 단일 페이지라 SPA fallback 설정은 필요하지 않습니다. Worker JS를 올바른 JavaScript MIME 타입으로 제공하는 정적 호스트를 사용하세요. 서브디렉터리에 배포하려면 Vite `base`와 정적 링크 경로를 해당 경로에 맞게 바꿔야 합니다. 기본 구성은 도메인 루트 배포입니다.

이 작업에서 제공되는 별도 호스팅 링크는 본인 전용 접근으로 배포합니다. Vercel/Netlify에서는 본인의 계정과 저장소로 동일 코드를 배포하면 됩니다.

## 소스 패키지 재생성

Python 3가 있다면 `python3 scripts/package-source.py`로 다운로드용 소스 ZIP을 재생성할 수 있습니다. ZIP에는 계정별 호스팅 설정, Git 메타데이터, node_modules, 빌드 결과, 임시 QA 파일을 넣지 않습니다. 소스 변경 후 재생성하고 다시 빌드하면 사이트 하단의 다운로드도 갱신됩니다. 일반 실행·빌드에는 Python이 필요하지 않습니다.

## 배포 참고 문서

- [Vite 정적 배포](https://vite.dev/guide/static-deploy.html)
- [Vercel의 Vite 안내](https://vercel.com/docs/frameworks/frontend/vite)
- [Netlify의 Vite 안내](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)

위 문서는 배포 방법 확인에만 사용했습니다. 예측 계수에 외부 식당 데이터나 후기를 사용하지 않았습니다.

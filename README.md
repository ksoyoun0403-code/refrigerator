# MYDISH

MYDISH는 식품 사진에서 유통기한을 인식해 냉장고를 관리하고, 보유 재료로 AI 레시피를 생성·공유하는 Expo 기반 모바일 서비스입니다.

## 주요 기능

### 회원과 사용자별 데이터

- 아이디, 비밀번호, 중복 불가 닉네임으로 회원가입 및 로그인
- Access Token 갱신과 로그아웃, 앱 재실행 시 로그인 상태 복원
- 냉장고, 저장 레시피, 공유 레시피를 로그인 사용자별로 분리
- My Page에서 닉네임과 비밀번호 변경
- 비밀번호 변경 시 모든 기기의 기존 세션 만료

현재 이메일을 수집하지 않으므로 아이디·비밀번호 찾기나 계정 복구는 제공하지 않습니다.

### 냉장고와 유통기한 인식

- 카메라 촬영 또는 앨범에서 JPEG/PNG 이미지 선택
- 10MB 이미지 크기 검증, 미리보기, 교체 및 제거
- Google Cloud Vision OCR과 Sharp 전처리를 이용한 날짜 후보 인식
- 인식된 식재료명, 수량, 단위, 구매일, 유통기한 확인 및 수정
- 직접 입력과 사진 인식 결과를 PostgreSQL에 영구 저장
- 식재료 조회, 수정, 삭제 및 영역 간 일괄 이동
- `보관 중`과 `사용 임박` 식재료를 유통기한이 가까운 순서로 표시
- 오늘보다 이전인 유통기한은 등록 차단
- 등록 완료 시 달력 날짜 기준 남은 소비 기간 안내

이미지는 OCR 요청 중 메모리에서만 처리하며 파일이나 데이터베이스에 저장하지 않습니다. 기본 인식기는 Google Cloud Vision이며 Tesseract.js 구현은 비교·대체용으로 유지합니다.

세부 사양은 [이미지 기반 식재료 등록](docs/specs/expiration-registration.md)에서 확인할 수 있습니다.

### 유통기한 알림

- 알림 사용 여부 설정
- `2일 전`, `1일 전`, `당일` 중 여러 시점 선택
- 시·분 단위로 알림 시간 지정
- 설정 저장 시 기존 MYDISH 예약을 취소한 뒤 현재 설정으로 다시 예약해 중복 알림 방지
- 이미 지난 알림 시점은 임의 시간으로 옮기지 않고 제외
- 등록 완료 화면에서 실제 예약 시점과 제외된 시점 안내
- 알림 권한 비활성화 및 예약 확인 실패 상태 안내

알림은 Backend 푸시가 아니라 Android 기기에 예약되는 로컬 알림입니다. 앱 데이터 삭제, 앱 재설치, 기기 알림 권한 해제 시 예약 상태가 달라질 수 있습니다.

### AI 레시피 생성

- 냉장고 재료를 최대 12개까지 선택
- 인원수, 최대 조리 시간, 기본 양념 보유 여부 설정
- 보유 재료 중심 레시피와 추가 재료 1~3개가 필요한 레시피 생성
- 재료별 손질 방법, 조리 순서 및 안전 주의사항 제공
- OpenAI Responses API와 Structured Outputs 기반 생성 결과 검증
- 생성한 레시피 저장·삭제 및 공유 레시피 게시
- 레시피의 필요 재료와 현재 냉장고를 비교하는 `보유 재료 확인`
- 재료별 충분함, 수량 부족, 단위 확인 필요 및 보관 재료 없음 상태 표시
- 공유 레시피와 나의 요리책 카드에 이름 기준 `보유 재료 3/4` 요약 표시
- 레시피별 `이 레시피로 요리하기` 확인 화면과 냉장고 재료 반영
- 확실한 동일 단위 및 `g↔kg`, `ml↔L` 자동 환산
- 자동 환산이 불가능하면 같은 이름의 냉장고 재료를 불러와 `요리 후 남은 양`과 저장 단위 직접 입력
- 자동 계산 결과는 간단히 표시하고 예외 재료만 직접 수정
- 반영 후에도 레시피 유지, 전량 사용한 냉장고 재료 제거 및 중복 반영 방지

세부 사양은 [AI 레시피 추천](docs/specs/recipe-suggestions.md), [저장 레시피](docs/specs/saved-recipes.md), [레시피 재료 차감](docs/specs/recipe-consumptions.md)에서 확인할 수 있습니다.

### 공유 레시피와 나의 요리책

- 닉네임, 레시피명, 재료를 카드에 표시하고 상세 화면에서 전체 레시피 조회
- 레시피명 또는 재료로 공유 레시피 검색
- 북마크 추가·해제 및 공개 북마크 횟수 표시
- 댓글 조회, 등록, 본인 댓글 수정·삭제
- `나의 요리책`에서 내가 공유한 레시피와 북마크한 레시피를 구분해 조회·검색
- 내가 공유한 레시피 삭제 전 확인, 북마크한 레시피의 북마크 해제

세부 사양은 [공유 레시피](docs/specs/community-recipes.md)에서 확인할 수 있습니다.

### 화면 구성

- 앱 시작 시 MYDISH 애니메이션 스플래시
- 하단 탭: `냉장고`, `AI 레시피 생성`, `공유 레시피`
- 상단 MYDISH 로고를 누르면 냉장고 탭으로 이동
- 공유 레시피 상단에서 `나의 요리책` 진입
- 로그인 사용자 메뉴는 `My Page`에서 관리

## 기술 구성

| 구분 | 기술 |
| --- | --- |
| Frontend | Expo 57, React Native 0.86, React 19, TypeScript |
| Backend | NestJS 11, Node.js, TypeScript, REST API |
| Database | PostgreSQL, Prisma |
| 이미지 처리 | Google Cloud Vision, Sharp, Tesseract.js(대체 구현) |
| AI 레시피 | OpenAI Responses API, Structured Outputs |
| 기기 기능 | Expo Image Picker, Notifications, Secure Store |

주요 디렉터리는 다음과 같습니다.

```text
front/                     Expo 모바일 앱
  src/features/auth/       인증과 My Page
  src/features/expiration/ 냉장고, 촬영, 유통기한 알림
  src/features/recipes/    AI 생성, 공유 레시피, 댓글, 나의 요리책
  src/features/splash/     애니메이션 스플래시
back/                      NestJS REST API
  src/auth/                인증과 세션
  src/expiration-*/        유통기한 인식과 식재료
  src/recipe-*/            AI 레시피, 공유 게시물, 댓글
  src/saved-recipes/       생성 레시피 저장
docs/specs/                기능별 상세 사양
```

## 실행 준비

- Node.js와 npm
- Docker Desktop 또는 별도 PostgreSQL
- Android 실기기 실행 시 Android SDK Platform Tools와 USB 디버깅
- 이미지 인식 사용 시 Google Cloud Vision 설정
- AI 레시피 생성 사용 시 OpenAI API Key

루트와 각 앱의 예제 파일을 참고해 환경변수를 설정합니다.

- `.env.example`: Docker PostgreSQL 설정
- `back/.env.example`: Database, Vision, OpenAI, JWT 설정
- `front/.env.example`: Backend API 주소

실제 `.env`, API Key, JWT Secret, 데이터베이스 비밀번호는 Git에 커밋하지 않습니다. `EXPO_PUBLIC_*` 값은 앱 사용자에게 노출될 수 있으므로 Secret을 넣지 않습니다.

## 일반 실행 방법

1. PostgreSQL을 실행합니다.

```bash
docker compose up -d postgres
```

2. Backend 환경변수를 준비하고 실행합니다.

```bash
cd back
npm install
npm run prisma:migrate:deploy
npm run start:dev
```

주요 Backend 환경변수 예시는 다음과 같습니다.

```dotenv
DATABASE_URL=postgresql://사용자:비밀번호@localhost:5432/mydish
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_VISION_API_KEY=
OPENAI_API_KEY=
OPENAI_RECIPE_MODEL=gpt-5-mini
AUTH_JWT_SECRET=32자_이상의_임의_문자열
```

3. Frontend 환경변수를 준비하고 Expo를 실행합니다.

```bash
cd front
npm install
npm run start
```

Android 에뮬레이터는 `http://10.0.2.2:3000/v1`, 같은 네트워크의 실기기는 개발 PC의 LAN IP(예: `http://192.168.0.10:3000/v1`)를 `EXPO_PUBLIC_API_URL`로 사용합니다.

## Android USB 디버그 실행

Windows에서 USB로 연결된 Android 기기를 사용할 때는 루트의 `START_MYDISH_USB.bat`를 실행할 수 있습니다. 이 스크립트는 다음 작업을 자동으로 처리합니다.

- 연결 기기와 USB 디버깅 승인 확인
- ADB의 `8081`(Metro), `3000`(Backend) 포트 reverse 설정
- 변경 범위에 따른 Android debug 앱 빌드·설치 판단
- PostgreSQL, Backend, Metro 실행 및 앱 시작
- APK 전송 실패 시 ADB 재시작 후 한 차례 재시도

휴대폰을 분리하기 전 별도 저장 작업은 필요하지 않지만 코드 변경사항은 Git에 커밋하고, 앱 데이터가 필요한 경우 PostgreSQL 데이터 볼륨을 유지해야 합니다.

## REST API

모든 경로의 기본 prefix는 `/v1`입니다. 인증이 필요한 요청은 Bearer Access Token을 사용합니다.

### 상태와 인증

- `GET /v1/health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`
- `PATCH /v1/auth/password`
- `PATCH /v1/users/me` — 닉네임 변경

### 식재료와 이미지 인식

- `POST /v1/expiration-scans` — `image` 필드의 multipart 이미지 업로드
- `GET /v1/expiration-items`
- `POST /v1/expiration-items`
- `PATCH /v1/expiration-items/:id`
- `DELETE /v1/expiration-items/:id`

### 레시피

- `POST /v1/recipe-suggestions` — 냉장고 재료 기반 AI 레시피 생성
- `GET /v1/saved-recipes`
- `POST /v1/saved-recipes`
- `DELETE /v1/saved-recipes/:id`
- `POST /v1/recipe-consumptions/preview` — 레시피와 냉장고 재료의 예상 차감 결과
- `POST /v1/recipe-consumptions` — 확인된 수량을 트랜잭션으로 차감

### 공유 레시피와 댓글

- `GET /v1/recipe-posts?q=`
- `GET /v1/recipe-posts/mine?q=`
- `GET /v1/recipe-posts/bookmarked?q=`
- `GET /v1/recipe-posts/:id`
- `POST /v1/recipe-posts`
- `DELETE /v1/recipe-posts/:id`
- `POST /v1/recipe-posts/:id/bookmark`
- `DELETE /v1/recipe-posts/:id/bookmark`
- `GET /v1/recipe-posts/:recipePostId/comments`
- `POST /v1/recipe-posts/:recipePostId/comments`
- `PATCH /v1/recipe-comments/:id`
- `DELETE /v1/recipe-comments/:id`

## 검증

Frontend 타입 검사:

```bash
cd front
npm run typecheck
```

Backend 타입 검사와 빌드:

```bash
cd back
npm run typecheck
npm run build
```

핵심 통합 검증:

```bash
cd back
npm run verify:core
```

`verify:core`는 Frontend/Backend 타입 검사와 인증, 사용자 프로필, 데이터베이스, 커뮤니티 게시물·댓글, AI 레시피 및 저장 레시피 검증 스크립트를 실행합니다. 일부 검증은 실행 중인 PostgreSQL과 올바른 `back/.env`가 필요합니다.

## 현재 제한 사항과 후속 작업

- 이메일 기반 아이디·비밀번호 찾기와 계정 복구 미지원
- 알림은 서버 푸시가 아닌 Android 로컬 예약 방식
- Google Cloud Vision과 OpenAI 기능은 각각 유효한 외부 API 설정 필요
- iOS 알림과 실제 배포 환경은 별도 검증 필요
- OCR 실패 이미지 및 여러 날짜가 함께 표시된 이미지의 인식 정확도 지속 보완 필요

UI 색상과 컴포넌트 원칙은 [디자인 시스템](docs/design-system.md)에서 확인할 수 있습니다.

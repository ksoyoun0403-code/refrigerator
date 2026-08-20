# mydish

이미지에서 유통기한 후보를 인식하고 식재료 정보를 냉장고 목록으로 관리하는 모바일 서비스입니다.

첫 번째 핵심 기능의 확정 사양은 [이미지 기반 식재료 등록 사양](docs/specs/expiration-registration.md)에서 확인할 수 있습니다.

## 구현 원칙

모든 부가 기능은 `식재료 목록`을 기준 데이터로 사용합니다. 먼저 아래 핵심 흐름을 완성한 뒤 바로 써야 하는 재료 분류, 알림, 검색, 레시피 추천 등을 붙입니다.

1. 카메라 또는 앨범에서 이미지 선택
2. 이미지 업로드 및 유통기한 후보 인식
3. 사용자가 식재료명, 수량, 단위와 선택적인 유통기한 확인 및 수정
4. 확인된 결과를 식재료 목록에 저장
5. 목록을 기반으로 알림·레시피 등 확장

## 현재 구현 상태

### Phase 1 — 이미지 기반 식재료 등록 (완료)

- `expo-image-picker`를 사용한 카메라 촬영 및 앨범 이미지 선택
- JPEG/PNG 이미지 미리보기, 교체, 제거 및 10MB 크기 검증
- `multipart/form-data` 이미지 업로드와 Google Cloud Vision 기반 날짜 인식
- Sharp 기반 자동 회전, 후보 영역 추출, 확대 및 명암 보정
- 여러 날짜 후보 표시와 사용자의 유통기한 확인·수정·삭제
- 식재료명, 수량, 단위 입력 및 구매일 기본값 처리
- PostgreSQL과 Prisma를 사용한 식재료 및 스캔 결과 영구 저장
- 등록 완료 후 냉장고 목록 자동 갱신

이미지는 OCR 요청 중에만 메모리에서 처리하며 파일이나 DB에 저장하지 않습니다. Backend의 기본 인식기는 Google Cloud Vision이고, Tesseract.js 구현은 비교와 대체를 위해 유지합니다. Google Cloud Vision은 검증용 실제 식품 이미지 16장 중 15장에서 정답 날짜를 후보에 포함했으며(93.8%), 평균 처리 시간은 약 0.55초였습니다.

### Phase 2 — 냉장고 목록 관리 (진행 중)

- 저장된 식재료 목록 조회
- 식재료 정보 수정 및 삭제
- `일반 냉장고`와 `사용 임박` 영역 분리
- 재료명과 유통기한만 표시하는 2열 카드 목록
- 편집 모드의 같은 영역 다중 선택, 반대 영역으로 일괄 이동 및 되돌리기
- 삭제 모드의 카드별 삭제
- 두 영역 모두 유통기한이 가까운 순서로 자동 정렬

영역 내부 순서는 유통기한을 기준으로 자동 관리하며 드래그 순서 변경은 제공하지 않습니다.

### 후속 Phase

1. Google Cloud Vision 실패 이미지와 다중 날짜 확인 흐름 보완
2. 유통기한 및 구매일 기반 알림
3. 식재료 검색과 필터
4. 보유 식재료 기반 레시피 추천
5. 사용자 인증과 사용자별 냉장고 분리

## 실행

루트의 `.env.example`, `back/.env.example`, `front/.env.example`을 참고해 각 환경변수를 설정합니다. 실제 Secret이 포함된 `.env` 파일은 Git에 커밋하지 않습니다.

PostgreSQL:

```bash
docker compose up -d postgres
```

백엔드:

```bash
cd back
npm install
npm run prisma:migrate:deploy
npm run start:dev
```

프론트:

```bash
cd front
copy .env.example .env
npm install
npm run start
```

실기기에서는 `.env`의 `EXPO_PUBLIC_API_URL`을 개발 PC의 로컬 IP로 바꿔야 합니다.

## API

- `GET /v1/health`
- `POST /v1/expiration-scans` — `image` 필드의 multipart 업로드
- `GET /v1/expiration-items`
- `POST /v1/expiration-items`
- `PATCH /v1/expiration-items/:id` — 식재료 정보 또는 냉장고 영역 수정
- `DELETE /v1/expiration-items/:id`

## 검증

Frontend:

```bash
cd front
npm run typecheck
```

Backend:

```bash
cd back
npm run typecheck
npm run build
```

OCR 날짜 파서, 이미지 전처리, Google Cloud Vision 응답 및 PostgreSQL 통합 검증용 스크립트는 `back/package.json`에서 확인할 수 있습니다.

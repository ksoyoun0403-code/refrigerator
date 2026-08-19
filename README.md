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

## 현재 준비된 범위

- `front`: 핵심 흐름을 보여주는 홈 화면, API 타입과 호출 경계
- `back`: 이미지 스캔 모듈, 교체 가능한 인식기 인터페이스, 유통기한 목록 모듈
- Backend 스캔 모듈의 기본 인식기는 Google Cloud Vision이며, Tesseract.js 구현은 비교와 대체를 위해 유지합니다.
- Google Cloud Vision은 실제 식품 이미지 16장 중 15장에서 정답 날짜가 후보에 포함됐고(93.8%), 평균 처리시간은 약 0.55초였습니다.
- 날짜 후보 충돌, 낮은 신뢰도와 OCR 보정 결과는 자동 확정하지 않고 사용자 확인 대상으로 반환합니다.
- 목록 저장소는 현재 메모리 방식이므로 서버 재시작 시 초기화됩니다.

## 다음 구현 순서

1. Google Cloud Vision 실패 이미지와 다중 날짜의 사용자 확인 정책 보완
2. PostgreSQL과 Prisma 영구 저장소 연결
3. 이미지 저장과 스캔 API 완성
4. `expo-image-picker`로 카메라·앨범 선택 연결
5. 식재료명, 수량, 단위와 선택적인 유통기한 입력 화면 구현
6. 촬영부터 DB 등록과 목록 갱신까지 전체 흐름 연결
7. 바로 써야 하는 재료 분류, 알림과 레시피 기능 추가

## 실행

백엔드:

```bash
cd back
npm install
npm run start:dev
```

프론트:

```bash
cd front
copy .env.example .env
npm install
npm run start
```

실기기에서는 `.env`의 `localhost`를 개발 PC의 로컬 IP로 바꿔야 합니다.

## API 골격

- `GET /v1/health`
- `POST /v1/expiration-scans` — `image` 필드의 multipart 업로드
- `GET /v1/expiration-items`
- `POST /v1/expiration-items`

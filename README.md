# mydish

이미지에서 식품명과 유통기한을 인식하고 냉장고 목록으로 관리하는 모바일 서비스입니다.

## 구현 원칙

모든 부가 기능은 `유통기한 목록`을 기준 데이터로 사용합니다. 먼저 아래 핵심 흐름을 완성한 뒤 알림, 검색, 레시피 추천 등을 붙입니다.

1. 카메라 또는 앨범에서 이미지 선택
2. 이미지 업로드 및 식품명·유통기한 인식
3. 사용자가 인식 결과 확인 및 수정
4. 확인된 결과를 유통기한 목록에 저장
5. 목록을 기반으로 알림·레시피 등 확장

## 현재 준비된 범위

- `front`: 핵심 흐름을 보여주는 홈 화면, API 타입과 호출 경계
- `back`: 이미지 스캔 모듈, 교체 가능한 인식기 인터페이스, 유통기한 목록 모듈
- 인식기는 현재 빈 후보를 반환하는 자리표시자입니다.
- 목록 저장소는 현재 메모리 방식이므로 서버 재시작 시 초기화됩니다.

## 다음 구현 순서

1. `expo-image-picker`로 카메라·앨범 선택 연결
2. OCR/비전 API를 `ExpirationRecognizer` 구현체로 연결
3. 인식 후보 확인·수정 화면 구현
4. PostgreSQL 등 영구 저장소 연결
5. 입력 검증, 인증, 테스트 추가
6. 유통기한 알림과 보유 식재료 기반 레시피 기능 추가

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

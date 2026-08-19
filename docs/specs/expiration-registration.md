# 이미지 기반 식재료 등록 사양

- 상태: 확정
- 작성일: 2026-08-19
- 대상 기능: 첫 번째 핵심 기능

## 1. 목적

사용자가 장치의 이미지 또는 카메라 촬영 이미지를 불러와 유통기한 후보를 스캔하고, 식재료 이름과 수량을 확인한 뒤 냉장고 목록에 영구 저장할 수 있게 합니다.

유통기한이 없거나 인식되지 않아도 등록할 수 있어야 하며, 구매일과 유통기한을 서로 다른 의미의 데이터로 보존합니다.

## 2. 범위

### 포함

- 카메라 촬영 또는 앨범 이미지 선택
- 이미지 미리보기, 교체, 제거
- Backend multipart 이미지 업로드
- Google Cloud Vision 기반 날짜 후보 인식
- 식재료 이름 입력
- 수량 숫자 입력과 단위 선택
- 구매일 기본값 처리
- 선택적인 유통기한 확인 및 수정
- PostgreSQL 영구 저장
- 저장된 식재료 목록 조회
- 향후 `바로 써야 하는 재료` 영역을 위한 위치 데이터

### 이번 기능에서 제외

- 드래그 앤 드롭 UI
- 알림
- 레시피 추천
- 사용자 인증
- 여러 이미지 동시 등록
- 클라우드 이미지 저장소
- 식재료 이름 자동 인식

## 3. 확정 기술

- Frontend: Expo, React Native, React, TypeScript
- 이미지 선택: `expo-image-picker`
- 통신: REST API
- Backend: NestJS, TypeScript, Express
- OCR: Backend에서 REST로 호출하는 Google Cloud Vision
- 이미지 전처리: Sharp
- Database: PostgreSQL
- ORM 및 Migration: Prisma
- 개발용 이미지 저장: Backend 로컬 파일 저장소

Google Cloud Vision과 Tesseract.js는 `ExpirationRecognizer` 인터페이스의 구현체로 격리합니다. 기본 공급자는 Google Cloud Vision으로 사용하며, Controller와 Frontend 계약을 유지한 채 다른 OCR 구현체로 교체할 수 있어야 합니다.

## 4. 사용자 흐름

1. 사용자가 `사진으로 추가`를 누릅니다.
2. `카메라로 촬영` 또는 `앨범에서 선택`을 고릅니다.
3. 선택한 이미지를 미리 보고 스캔을 시작합니다.
4. Frontend가 이미지를 Backend에 업로드합니다.
5. Backend가 이미지를 보관하고 Google Cloud Vision으로 날짜 후보를 찾습니다.
6. Frontend가 인식 결과 확인 폼을 표시합니다.
7. 사용자가 식재료 이름, 수량, 단위와 선택적인 유통기한을 확인하거나 수정합니다.
8. 사용자가 `등록`을 누릅니다.
9. Backend가 확인된 데이터를 PostgreSQL에 저장합니다.
10. Frontend가 입력 상태를 초기화하고 새 항목을 목록에 표시합니다.

## 5. 입력 사양

### 5.1 이미지

- 필수입니다.
- 한 번에 한 장만 등록합니다.
- 허용 MIME 형식은 `image/jpeg`, `image/png`입니다.
- 최대 파일 크기는 10MB입니다.
- 원본 파일명을 저장 경로로 사용하지 않습니다.
- Backend가 UUID 기반 파일명을 생성합니다.
- DB에는 장치의 로컬 URI나 이미지 바이너리가 아니라 `imageKey`를 저장합니다.
- 개발용 기본 저장 디렉터리는 `back/uploads`입니다.

HEIC를 포함한 다른 형식은 초기 버전에서 지원하지 않습니다. 지원하지 않는 형식은 명확한 오류 메시지로 다시 선택하도록 안내합니다.

### 5.2 식재료 이름

- 필수입니다.
- 사용자가 직접 입력합니다.
- 앞뒤 공백을 제거한 뒤 1자 이상 100자 이하이어야 합니다.
- 초기 OCR 범위에는 식재료 이름 자동 인식을 포함하지 않습니다.

### 5.3 수량

- 필수입니다.
- 0보다 커야 합니다.
- 최댓값은 `999999`입니다.
- 소수점 아래 최대 3자리까지 허용합니다.
- Frontend와 REST API에서는 문자열로 전달합니다.
- DB에서는 부동소수점이 아닌 Decimal로 저장합니다.

예시:

```json
{
  "quantity": "1.5"
}
```

### 5.4 단위

Frontend는 숫자 입력 오른쪽에서 단위를 선택하는 UI를 제공합니다.

| 코드 | 표시값 |
|---|---|
| `COUNT` | 개 |
| `G` | g |
| `KG` | kg |
| `ML` | ml |
| `L` | L |
| `PACK` | 팩 |
| `BAG` | 봉 |
| `BOTTLE` | 병 |
| `CAN` | 캔 |

목록에 없는 단위 코드는 Backend에서 거부합니다.

### 5.5 구매일

- `purchasedAt`으로 저장합니다.
- 요청에서 생략하면 등록 당일을 기본값으로 사용합니다.
- 기본 날짜는 Backend의 업무 시간대인 `Asia/Seoul`을 기준으로 계산합니다.
- 날짜 형식은 `YYYY-MM-DD`입니다.
- 레코드 생성 시각인 `createdAt`과 의미를 구분합니다.

### 5.6 유통기한

- `expirationDate`로 저장합니다.
- 선택 사항입니다.
- 값이 없으면 `null`로 저장합니다.
- 구매일이나 등록일로 대체하지 않습니다.
- 값이 있을 때 형식은 `YYYY-MM-DD`입니다.
- 인식 결과를 사용자가 수정하거나 제거할 수 있습니다.
- 유통기한이 없는 항목은 화면에 `유통기한 미입력`으로 표시합니다.

## 6. OCR 사양

### 6.1 역할

첫 버전의 OCR은 식재료 이름이 아니라 유통기한 또는 소비기한으로 사용할 수 있는 날짜 후보 추출에 집중합니다.

### 6.2 지원할 날짜 표현

- `2026.08.25`
- `2026-08-25`
- `2026/08/25`
- `20260825`
- `2026년 8월 25일`
- `26.08.25`

### 6.3 날짜 처리 규칙

- 유효하지 않은 달과 날짜는 후보에서 제외합니다.
- 같은 날짜가 여러 번 검출되면 중복을 제거합니다.
- 과거 날짜라는 이유만으로 후보를 제거하지 않습니다.
- 두 자리 연도는 `20YY` 후보로 표시하되 사용자의 확인이 필요함을 표시합니다.
- 후보가 여러 개면 임의로 하나를 최종 확정하지 않습니다.
- `유통기한`, `소비기한`, `까지`가 가까이 있는 날짜를 우선 후보로 정렬합니다.
- 후보가 없어도 스캔 요청 자체는 성공하며 빈 후보 목록을 반환합니다.
- OCR 원문 전체는 기본적으로 DB나 일반 로그에 저장하지 않습니다.

### 6.4 정확도 검증 기준

- 직접 사용 권한이 있는 대표 이미지 20~30장으로 검증합니다.
- 선명한 날짜 이미지 20장 중 최소 17장에서 올바른 날짜가 후보에 포함되어야 합니다.
- 날짜가 없는 이미지에서는 빈 후보를 반환해야 합니다.
- 개발 환경에서 대부분의 이미지가 5초 안에 처리되는 것을 목표로 합니다.
- 기준을 충족하지 못하면 촬영 안내, 날짜 파서, 회전 및 크기 조정을 먼저 개선합니다.
- 전체 상품 이미지에서 날짜 영역 인식이 어려운 것이 확인되어 Sharp로 자동 회전, 후보 영역 추출, 확대 및 명암 보정 단계를 적용합니다.

## 7. 데이터 모델

### 7.1 ExpirationScan

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | UUID | Primary Key |
| `status` | Enum | `PROCESSING`, `NEEDS_REVIEW`, `CONFIRMED`, `FAILED` |
| `imageKey` | String | Backend 이미지 저장 키 |
| `recognizedExpirationDate` | Date? | 대표 인식 후보, 없으면 null |
| `confidence` | Decimal? | 대표 후보 신뢰도 |
| `createdAt` | DateTime | UTC 생성 시각 |
| `updatedAt` | DateTime | UTC 수정 시각 |

### 7.2 ExpirationItem

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | UUID | Primary Key |
| `scanId` | UUID | 확정된 스캔, 중복 등록 불가 |
| `name` | String | 1~100자 |
| `quantity` | Decimal | 0 초과, 최대 소수점 3자리 |
| `unit` | Enum | 정의된 단위 코드 |
| `purchasedAt` | Date | 생략 시 등록 당일 |
| `expirationDate` | Date? | 선택값 |
| `imageKey` | String | 스캔 이미지 저장 키 |
| `source` | Enum | 초기값 `IMAGE` |
| `section` | Enum | 초기값 `DEFAULT` |
| `sortOrder` | Integer | 영역 내부 표시 순서 |
| `createdAt` | DateTime | UTC 생성 시각 |
| `updatedAt` | DateTime | UTC 수정 시각 |

### 7.3 향후 위치 정보

`section`은 다음 값을 사용합니다.

- `DEFAULT`: 일반 냉장고 목록
- `USE_SOON`: 바로 써야 하는 재료

첫 번째 등록 기능에서는 모든 항목을 `DEFAULT`로 저장합니다. 드래그 기능은 후속 Phase에서 구현하지만, DB 필드는 최초 Migration부터 포함합니다.

## 8. REST API 계약

기본 경로는 `/v1`입니다.

### 8.1 이미지 스캔

```http
POST /v1/expiration-scans
Content-Type: multipart/form-data
```

요청 필드:

```text
image: JPEG 또는 PNG 파일
```

성공 응답 예시:

```json
{
  "scanId": "uuid",
  "status": "needs_review",
  "candidates": [
    {
      "rawText": "26.08.25",
      "expirationDate": "2026-08-25",
      "confidence": 0.87,
      "requiresConfirmation": true
    }
  ]
}
```

오류:

- `400`: 이미지 누락 또는 지원하지 않는 형식
- `413`: 파일 크기 초과
- `500`: 내부 처리 오류

날짜를 찾지 못한 것은 오류가 아니며 `candidates`가 빈 배열인 성공 응답으로 처리합니다.

### 8.2 식재료 등록

```http
POST /v1/expiration-items
Content-Type: application/json
```

요청 예시:

```json
{
  "scanId": "uuid",
  "name": "우유",
  "quantity": "1",
  "unit": "L",
  "expirationDate": null
}
```

`purchasedAt`을 생략하면 Backend가 `Asia/Seoul` 기준 등록 당일을 저장합니다.

성공 응답 예시:

```json
{
  "id": "uuid",
  "scanId": "uuid",
  "name": "우유",
  "quantity": "1",
  "unit": "L",
  "purchasedAt": "2026-08-19",
  "expirationDate": null,
  "imageKey": "expiration-images/uuid.jpg",
  "source": "image",
  "section": "DEFAULT",
  "sortOrder": 0,
  "createdAt": "2026-08-19T00:00:00.000Z"
}
```

등록은 하나의 DB Transaction으로 처리합니다.

1. `scanId`의 존재와 상태를 확인합니다.
2. 식재료 레코드를 생성합니다.
3. 스캔 상태를 `CONFIRMED`로 변경합니다.
4. 하나라도 실패하면 전체 변경을 취소합니다.

같은 `scanId`로 두 번 등록할 수 없습니다.

### 8.3 목록 조회

```http
GET /v1/expiration-items
```

유통기한이 없는 항목도 포함합니다.

### 8.4 후속 위치 변경 API

드래그 기능을 구현할 때 다음 API를 추가합니다.

```http
PATCH /v1/expiration-items/:id/placement
```

```json
{
  "section": "USE_SOON",
  "sortOrder": 0
}
```

## 9. Frontend 상태

화면은 다음 상태를 명시적으로 구분합니다.

- `idle`: 이미지 미선택
- `image_selected`: 이미지 선택 완료
- `scanning`: 업로드 및 OCR 진행 중
- `reviewing`: OCR 결과 및 등록 정보 확인 중
- `submitting`: DB 등록 중
- `success`: 등록 완료
- `error`: 재시도 가능한 오류

스캔 또는 등록 중에는 해당 버튼을 비활성화하여 중복 요청을 방지합니다.

## 10. 보안 및 데이터 보호

- Google Cloud Vision API Key는 Backend의 `GOOGLE_CLOUD_VISION_API_KEY` 환경변수에만 저장합니다.
- PostgreSQL 접속 문자열은 Backend의 `DATABASE_URL` 환경변수에만 저장합니다.
- 실제 `.env`는 Git에 커밋하지 않습니다.
- `EXPO_PUBLIC_*`에는 Secret을 저장하지 않습니다.
- 업로드된 파일의 MIME 형식과 크기를 Backend에서 다시 검증합니다.
- 사용자가 보낸 원본 파일명을 저장 경로로 직접 사용하지 않습니다.
- OCR 원문이나 이미지 내용을 일반 로그에 출력하지 않습니다.

## 11. 완료 조건

- 카메라 또는 앨범 이미지를 선택할 수 있습니다.
- 선택 이미지를 Backend로 업로드할 수 있습니다.
- Google Cloud Vision이 날짜 후보 또는 빈 후보 목록을 반환합니다.
- 사용자가 이름, 수량, 단위를 입력할 수 있습니다.
- 사용자가 유통기한을 입력, 수정 또는 비울 수 있습니다.
- 구매일을 생략하면 등록 당일이 저장됩니다.
- 등록 버튼을 누르면 PostgreSQL에 데이터가 한 번만 저장됩니다.
- 서버를 재시작해도 등록 데이터가 유지됩니다.
- 저장된 항목을 목록에서 확인할 수 있습니다.
- Frontend TypeScript 검사와 Backend TypeScript 검사 및 Build가 통과합니다.

## 12. 알려진 후속 작업

- `DEFAULT`와 `USE_SOON` 사이의 드래그 이동
- 영역 내부 순서 변경과 저장
- 유통기한 및 구매 후 경과 기간 알림
- 운영용 객체 저장소 Adapter
- 확정되지 않은 스캔 이미지의 보존 기간과 정리 정책
- 실제 사용자 이미지 기반 OCR 정확도 재측정

# AGENTS.md

## 프로젝트 목적

`mydish`는 식품 이미지를 기반으로 식품명과 유통기한을 인식하고, 인식 결과를 사용자가 확인·수정한 뒤 냉장고 목록으로 관리하는 모바일 서비스입니다.

핵심 구현 순서는 다음과 같습니다.

1. 카메라 또는 앨범에서 이미지 선택
2. 이미지 업로드
3. 식품명과 유통기한 인식
4. 인식 결과 확인 및 수정
5. 확인된 데이터를 유통기한 목록에 저장
6. 저장된 목록을 기반으로 알림, 검색, 레시피 추천 등의 기능 확장

부가 기능보다 이미지 인식과 유통기한 목록 관리 흐름을 우선하여 구현합니다.

## Frontend 기술

Frontend는 `front` 디렉터리에 위치합니다.

주요 기술은 다음과 같습니다.

- Expo
- React Native
- React
- TypeScript
- Expo 환경변수(`EXPO_PUBLIC_*`)
- REST API 기반 Backend 통신

Frontend 코드는 기능 단위로 구성합니다.

현재 유통기한 관련 기능은 다음 경로에 위치합니다.

```text
front/
├── App.tsx
└── src/
    └── features/
        └── expiration/
            ├── ExpirationHomeScreen.tsx
            ├── expirationApi.ts
            └── types.ts
```

새로운 화면, API 함수, 타입 또는 컴포넌트를 추가할 때는 가능한 한 관련 기능 디렉터리 내부에 배치합니다.

여러 기능이 공통으로 사용하는 코드가 생겼을 때만 공통 디렉터리로 분리합니다.

## Backend 기술

Backend는 `back` 디렉터리에 위치합니다.

주요 기술은 다음과 같습니다.

- NestJS
- TypeScript
- Node.js
- Express 기반 HTTP 서버
- REST API
- Multipart 이미지 업로드

현재 데이터는 메모리에 임시 저장됩니다. 영구 저장이 필요해지는 시점에 데이터베이스와 Repository 계층을 추가합니다.

## Backend 기본 구조

Backend는 기능 단위 NestJS 모듈로 구성합니다.

```text
back/src/
├── main.ts
├── app.module.ts
├── app.controller.ts
├── expiration-scans/
│   ├── expiration-scans.module.ts
│   ├── expiration-scans.controller.ts
│   ├── expiration-scans.service.ts
│   ├── expiration-recognizer.port.ts
│   └── placeholder-expiration-recognizer.ts
└── expiration-items/
    ├── expiration-items.module.ts
    ├── expiration-items.controller.ts
    ├── expiration-items.service.ts
    └── expiration-item.ts
```

각 계층은 다음 책임을 가집니다.

- `controller`: HTTP 요청과 응답 처리
- `service`: 애플리케이션 흐름과 비즈니스 로직 처리
- `module`: 기능에 필요한 Controller와 Provider 구성
- `*.port.ts`: 외부 서비스 또는 인프라와 연결되는 인터페이스 정의
- 외부 연동 구현체: OCR, Vision API, 데이터베이스 등의 구체적인 연결 처리

Controller에 복잡한 비즈니스 로직을 직접 작성하지 않습니다.

이미지 인식 공급자는 `ExpirationRecognizer` 인터페이스를 통해 연결합니다. 특정 OCR 또는 Vision 서비스에 Backend 전체가 직접 의존하지 않도록 유지합니다.

향후 알림, 인증, 레시피 등의 기능은 각각 별도 NestJS 모듈로 추가합니다.

## REST API 사용

Frontend와 Backend 간 통신에는 REST API를 사용합니다.

현재 기본 API 경로는 `/v1`입니다.

현재 API 골격은 다음과 같습니다.

- `GET /v1/health`: Backend 서버의 실행 상태를 확인하는 운영용 API
- `POST /v1/expiration-scans`
- `GET /v1/expiration-items`
- `POST /v1/expiration-items`

이미지는 `POST /v1/expiration-scans`에 `multipart/form-data` 형식으로 전송하며 필드 이름은 `image`를 사용합니다.

API를 추가하거나 변경할 때는 다음 사항을 지킵니다.

- URL은 리소스 중심으로 작성합니다.
- 적절한 HTTP Method와 상태 코드를 사용합니다.
- 요청과 응답 타입을 명확하게 정의합니다.
- Frontend와 Backend의 데이터 구조가 일치하는지 확인합니다.
- 기존 API의 호환성을 불필요하게 깨지 않습니다.
- API 구조가 변경되면 관련 문서와 Frontend 호출 코드도 함께 수정합니다.

## Library 추가 원칙

불필요한 Library를 추가하지 않습니다.

새 Library를 추가하기 전 다음 사항을 확인합니다.

1. 현재 사용 중인 기능이나 표준 API로 해결할 수 있는지 확인합니다.
2. 직접 구현하는 것보다 Library 사용이 명확하게 안전하고 유지보수에 유리한지 확인합니다.
3. 프로젝트 규모에 비해 지나치게 무거운 Library가 아닌지 확인합니다.
4. 기존 Library와 기능이 중복되지 않는지 확인합니다.
5. Frontend에서는 현재 Expo SDK와 호환되는 버전인지 확인합니다.

Library 추가가 필요하다면 추가 이유와 사용 위치를 먼저 설명합니다.

## Secret 관리

API Key, Token, 비밀번호, 데이터베이스 접속 정보 등의 Secret을 코드에 직접 작성하지 않습니다.

Secret은 환경변수로 관리합니다.

- Frontend 공개 설정: `EXPO_PUBLIC_*`
- Backend Secret: Backend 전용 환경변수

Frontend에 포함되는 `EXPO_PUBLIC_*` 값은 앱 사용자에게 노출될 수 있으므로 비밀값을 저장하지 않습니다.

다음 정보는 Git에 커밋하지 않습니다.

- 실제 `.env` 파일
- API Key
- Access Token
- Refresh Token
- 비밀번호
- Private Key
- 데이터베이스 접속 문자열

필요한 환경변수의 이름과 예시는 `.env.example`에 작성하되 실제 Secret 값은 포함하지 않습니다.

## 기존 파일 보호

기존 파일을 대량으로 삭제하거나 전면 교체하지 않습니다.

변경할 때는 다음 원칙을 지킵니다.

- 요청 범위와 관련된 파일만 수정합니다.
- 기존 동작과 사용자 작업을 최대한 보존합니다.
- 관련 없는 코드 정리나 대규모 리팩터링을 함께 진행하지 않습니다.
- 파일 삭제가 필요하면 사용처를 먼저 확인합니다.
- 대량 삭제 또는 구조 변경이 필요한 경우 작업 전에 이유와 영향을 설명합니다.
- Git 상태를 확인하고 기존의 미커밋 변경사항을 덮어쓰지 않습니다.
- 명시적인 요청 없이 `git reset --hard` 등의 파괴적인 명령을 사용하지 않습니다.

## 변경 계획 설명

큰 기능 추가, 아키텍처 변경, 데이터 구조 변경 또는 여러 파일에 영향을 주는 작업은 구현 전에 계획을 먼저 설명합니다.

계획에는 다음 내용을 포함합니다.

- 변경 목적
- 구현 범위
- 변경하거나 추가할 주요 파일
- 기존 기능에 미치는 영향
- Library 또는 환경변수 추가 여부
- 검증 방법

작은 오타 수정이나 명확한 단일 파일 변경에는 과도한 계획을 작성할 필요가 없습니다.

## 구현 후 검증

구현이 끝나면 변경 범위에 맞는 Build 또는 테스트를 실행합니다.

기본 검증 명령은 다음과 같습니다.

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

테스트가 추가된 경우 관련 테스트도 실행합니다.

검증이 실패하면 다음 내용을 확인하고 보고합니다.

- 실패한 명령
- 주요 오류 내용
- 실패 원인
- 해결 여부
- 해결하지 못했다면 남아 있는 작업

실행 환경이나 외부 서비스 문제로 검증할 수 없는 경우에도 검증하지 못한 항목과 이유를 명확하게 설명합니다.

## 작업 완료 보고

작업 마지막에는 다음 내용을 설명합니다.

- 구현하거나 변경한 기능
- 변경한 파일과 각 파일의 역할
- 추가하거나 변경한 API
- 추가한 Library 또는 환경변수
- 실행한 Build 또는 테스트와 결과
- 아직 구현되지 않은 부분이나 후속 작업

변경하지 않은 기능을 구현된 것처럼 설명하지 않습니다.

자리표시자, Mock, 메모리 저장소를 사용했다면 실제 구현이 아니라는 점을 명확하게 표시합니다.

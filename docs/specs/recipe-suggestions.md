# AI 레시피 추천 사양

- 작성일: 2026-08-21
- 상태: 구현 완료, OpenAI API Key 설정 필요

## 목적

사용자가 냉장고에 등록한 재료를 여러 개 선택하면 다음 순서로 한국어 레시피를 제안합니다.

1. 보유 재료와 허용한 기본 양념만 사용하는 레시피
2. 추가 재료 1~3개로 만들 수 있는 레시피

각 그룹은 응답 지연과 출력량을 줄이기 위해 최대 2개의 레시피를 제공합니다.

모든 레시피는 조리 순서보다 먼저 재료별 손질 방법을 제공합니다.

## 사용자 입력

- 냉장고 식재료 ID: 1~12개
- 인원수: 1~6명
- 최대 조리 시간: 10~180분
- 기본 양념 보유 가정 여부

기본 양념으로 인정하는 항목은 `물`, `소금`, `후추`, `식용유`입니다. 이 옵션을 끄면 해당 양념도 보유 재료 또는 추가 재료로 취급해야 합니다.

## API

```http
POST /v1/recipe-suggestions
Content-Type: application/json
```

요청 예시:

```json
{
  "itemIds": ["11111111-1111-4111-8111-111111111111"],
  "servings": 2,
  "maxCookingMinutes": 30,
  "assumeBasicSeasonings": true
}
```

응답 예시:

```json
{
  "availableOnly": [
    {
      "title": "두부 구이",
      "summary": "두부를 노릇하게 굽는 간단한 요리",
      "servings": 2,
      "cookingMinutes": 20,
      "usedIngredients": [{ "name": "두부", "amount": "1모" }],
      "basicSeasonings": ["식용유", "소금"],
      "missingIngredients": [],
      "preparationSteps": [
        { "ingredientName": "두부", "instruction": "물기를 제거하고 썹니다." }
      ],
      "cookingSteps": ["팬에서 앞뒤로 충분히 굽습니다."],
      "safetyNotes": ["상한 두부는 사용하지 않습니다."]
    }
  ],
  "needsFewMore": [],
  "generatedAt": "2026-08-21T00:00:00.000Z"
}
```

## OpenAI 연결

Backend의 `.env`에만 다음 값을 설정합니다.

```dotenv
OPENAI_API_KEY=실제_API_KEY
OPENAI_RECIPE_MODEL=gpt-5-mini
```

`OPENAI_API_KEY`는 Frontend 또는 `EXPO_PUBLIC_*` 환경변수에 넣지 않습니다. 모델은 `OPENAI_RECIPE_MODEL`로 교체할 수 있습니다.

Backend는 OpenAI Responses API와 JSON Schema 기반 Structured Outputs를 사용합니다. AI 응답을 그대로 신뢰하지 않고 다음 조건을 다시 검사합니다.

응답 지연을 줄이기 위해 추론 강도는 `low`, 최대 출력은 4,000토큰으로 제한하며 Backend 요청 타임아웃은 90초입니다.

- `availableOnly`: 추가 재료 0개
- `needsFewMore`: 추가 재료 1~3개
- 요청한 인원수와 최대 조리 시간 준수
- 기본 양념 옵션과 허용 목록 준수
- 재료 손질 및 조리 단계 존재

## 안전 및 제한

- AI가 생성한 조리법이므로 알레르기와 식재료 상태를 사용자가 다시 확인해야 합니다.
- 육류, 달걀, 해산물은 충분히 가열하도록 안내합니다.
- 레시피 결과는 현재 DB에 저장하지 않습니다.
- API Key가 없으면 Backend는 실행되지만 레시피 요청은 `503`으로 실패합니다.

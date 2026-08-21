const assert = require('node:assert/strict');
const test = require('node:test');
const {
  extractOpenAIOutputText,
  OpenAiRecipeGenerator,
} = require('../dist/recipe-suggestions/openai-recipe-generator.js');
const {
  normalizeRecipeSuggestionGroups,
  validateRecipeSuggestionRequest,
} = require('../dist/recipe-suggestions/recipe-suggestion-validator.js');

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

function recipe(overrides = {}) {
  return {
    title: '두부 구이',
    summary: '두부를 노릇하게 굽는 간단한 요리',
    servings: 2,
    cookingMinutes: 20,
    usedIngredients: [{ name: '두부', amount: '1모' }],
    basicSeasonings: ['식용유', '소금'],
    missingIngredients: [],
    preparationSteps: [
      { ingredientName: '두부', instruction: '물기를 제거하고 썬다.' },
    ],
    cookingSteps: ['팬에서 앞뒤로 충분히 굽는다.'],
    safetyNotes: ['상한 두부는 사용하지 않는다.'],
    ...overrides,
  };
}

test('validates and deduplicates selected item ids', () => {
  const result = validateRecipeSuggestionRequest({
    itemIds: [ITEM_ID, ITEM_ID],
    servings: 2,
    maxCookingMinutes: 30,
    assumeBasicSeasonings: true,
  });

  assert.deepEqual(result.itemIds, [ITEM_ID]);
});

test('rejects an empty ingredient selection', () => {
  assert.throws(
    () =>
      validateRecipeSuggestionRequest({
        itemIds: [],
        servings: 2,
        maxCookingMinutes: 30,
        assumeBasicSeasonings: true,
      }),
    /1~12/,
  );
});

test('keeps only recipes matching each group semantic rule', () => {
  const result = normalizeRecipeSuggestionGroups(
    {
      availableOnly: [
        recipe(),
        recipe({ title: '잘못된 분류', missingIngredients: [{ name: '대파', amount: '1대' }] }),
      ],
      needsFewMore: [
        recipe({ title: '대파 추가', missingIngredients: [{ name: '대파', amount: '1대' }] }),
        recipe({ title: '추가 재료 없음' }),
        recipe({
          title: '추가 재료 과다',
          missingIngredients: [
            { name: '대파', amount: '1대' },
            { name: '마늘', amount: '1쪽' },
            { name: '양파', amount: '1개' },
            { name: '고추', amount: '1개' },
          ],
        }),
      ],
    },
    { servings: 2, maxCookingMinutes: 30, assumeBasicSeasonings: true },
  );

  assert.deepEqual(result.availableOnly.map(({ title }) => title), ['두부 구이']);
  assert.deepEqual(result.needsFewMore.map(({ title }) => title), ['대파 추가']);
});

test('rejects recipes that assume seasonings when the option is off', () => {
  const result = normalizeRecipeSuggestionGroups(
    { availableOnly: [recipe()], needsFewMore: [] },
    { servings: 2, maxCookingMinutes: 30, assumeBasicSeasonings: false },
  );

  assert.deepEqual(result.availableOnly, []);
});

test('limits each recipe group to two results', () => {
  const result = normalizeRecipeSuggestionGroups(
    {
      availableOnly: [
        recipe({ title: '첫 번째' }),
        recipe({ title: '두 번째' }),
        recipe({ title: '세 번째' }),
      ],
      needsFewMore: [],
    },
    { servings: 2, maxCookingMinutes: 30, assumeBasicSeasonings: true },
  );

  assert.deepEqual(result.availableOnly.map(({ title }) => title), [
    '첫 번째',
    '두 번째',
  ]);
});

test('extracts structured output text from a Responses API result', () => {
  const text = extractOpenAIOutputText({
    output: [{ content: [{ type: 'output_text', text: '{"availableOnly":[]}' }] }],
  });

  assert.equal(text, '{"availableOnly":[]}');
});

test('sends a Responses API structured-output request without an SDK', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let requestBody;
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ availableOnly: [recipe()], needsFewMore: [] }),
              },
            ],
          },
        ],
      }),
    };
  };

  try {
    const result = await new OpenAiRecipeGenerator().generate({
      ingredients: [
        {
          id: ITEM_ID,
          name: '두부',
          quantity: '1',
          unit: 'COUNT',
          expirationDate: '2026-08-22',
        },
      ],
      servings: 2,
      maxCookingMinutes: 30,
      assumeBasicSeasonings: true,
    });

    assert.equal(requestBody.model, 'gpt-5-mini');
    assert.equal(requestBody.store, false);
    assert.equal(requestBody.reasoning.effort, 'low');
    assert.equal(requestBody.max_output_tokens, 4000);
    assert.equal(requestBody.text.format.type, 'json_schema');
    assert.equal(requestBody.text.format.strict, true);
    assert.equal(
      requestBody.text.format.schema.properties.availableOnly.maxItems,
      2,
    );
    assert.equal(
      requestBody.text.format.schema.properties.needsFewMore.maxItems,
      2,
    );
    assert.equal(result.availableOnly[0].title, '두부 구이');
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

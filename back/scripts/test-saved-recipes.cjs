const assert = require('node:assert/strict');
const test = require('node:test');
const {
  recipeFingerprint,
  validateSavedRecipeInput,
} = require('../dist/saved-recipes/saved-recipes.service.js');

function recipe(overrides = {}) {
  return {
    title: '당근 샐러드',
    summary: '당근을 활용한 간단한 샐러드',
    servings: 2,
    cookingMinutes: 15,
    usedIngredients: [{ name: '당근', amount: '1개' }],
    basicSeasonings: ['소금'],
    missingIngredients: [],
    preparationSteps: [
      { ingredientName: '당근', instruction: '깨끗이 씻어 채 썬다.' },
    ],
    cookingSteps: ['당근에 소금을 넣어 버무린다.'],
    safetyNotes: ['재료 상태를 확인한다.'],
    ...overrides,
  };
}

test('accepts a complete generated recipe for saving', () => {
  assert.deepEqual(validateSavedRecipeInput(recipe()), recipe());
});

test('rejects a recipe with unsupported seasoning', () => {
  assert.throws(
    () => validateSavedRecipeInput(recipe({ basicSeasonings: ['간장'] })),
    /저장할 레시피 정보를 확인해주세요/,
  );
});

test('creates a stable fingerprint for duplicate prevention', () => {
  assert.equal(recipeFingerprint(recipe()), recipeFingerprint(recipe()));
  assert.notEqual(
    recipeFingerprint(recipe()),
    recipeFingerprint(recipe({ title: '다른 레시피' })),
  );
});

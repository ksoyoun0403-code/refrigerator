import { BadRequestException } from '@nestjs/common';
import {
  BASIC_SEASONINGS,
  NamedAmount,
  PreparationStep,
  RecipeSuggestion,
  RecipeSuggestionGroups,
  RecipeSuggestionRequest,
} from './recipe-suggestion';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SELECTED_ITEMS = 12;
const MAX_RECIPES_PER_GROUP = 2;

export function validateRecipeSuggestionRequest(
  input: unknown,
): RecipeSuggestionRequest {
  if (!isRecord(input)) {
    throw new BadRequestException('레시피 요청 정보를 확인해주세요.');
  }

  const itemIds = Array.isArray(input.itemIds)
    ? [...new Set(input.itemIds.filter((id): id is string => typeof id === 'string'))]
    : [];
  if (
    itemIds.length === 0 ||
    itemIds.length > MAX_SELECTED_ITEMS ||
    itemIds.some((id) => !UUID_PATTERN.test(id))
  ) {
    throw new BadRequestException(
      `유효한 식재료를 1~${MAX_SELECTED_ITEMS}개 선택해주세요.`,
    );
  }

  const servings = input.servings;
  if (!Number.isInteger(servings) || Number(servings) < 1 || Number(servings) > 6) {
    throw new BadRequestException('인원수는 1~6명으로 선택해주세요.');
  }

  const maxCookingMinutes = input.maxCookingMinutes;
  if (
    !Number.isInteger(maxCookingMinutes) ||
    Number(maxCookingMinutes) < 10 ||
    Number(maxCookingMinutes) > 180
  ) {
    throw new BadRequestException('조리 시간은 10~180분으로 선택해주세요.');
  }

  if (typeof input.assumeBasicSeasonings !== 'boolean') {
    throw new BadRequestException('기본 양념 보유 여부를 선택해주세요.');
  }

  return {
    itemIds,
    servings: Number(servings),
    maxCookingMinutes: Number(maxCookingMinutes),
    assumeBasicSeasonings: input.assumeBasicSeasonings,
  };
}

export function normalizeRecipeSuggestionGroups(
  input: unknown,
  options: {
    servings: number;
    maxCookingMinutes: number;
    assumeBasicSeasonings: boolean;
  },
): RecipeSuggestionGroups {
  if (!isRecord(input)) {
    throw new Error('OpenAI returned an invalid recipe response.');
  }

  return {
    availableOnly: normalizeGroup(
      input.availableOnly,
      'availableOnly',
      options,
    ),
    needsFewMore: normalizeGroup(
      input.needsFewMore,
      'needsFewMore',
      options,
    ),
  };
}

function normalizeGroup(
  value: unknown,
  group: 'availableOnly' | 'needsFewMore',
  options: {
    servings: number;
    maxCookingMinutes: number;
    assumeBasicSeasonings: boolean;
  },
) {
  if (!Array.isArray(value)) {
    throw new Error('OpenAI returned an invalid recipe group.');
  }

  return value
    .map(parseRecipeSuggestion)
    .filter((recipe): recipe is RecipeSuggestion => {
      if (!recipe) return false;
      if (recipe.servings !== options.servings) return false;
      if (recipe.cookingMinutes > options.maxCookingMinutes) return false;
      if (!options.assumeBasicSeasonings && recipe.basicSeasonings.length > 0) {
        return false;
      }
      if (
        recipe.basicSeasonings.some(
          (seasoning) => !BASIC_SEASONINGS.includes(seasoning as never),
        )
      ) {
        return false;
      }
      return group === 'availableOnly'
        ? recipe.missingIngredients.length === 0
        : recipe.missingIngredients.length >= 1 &&
            recipe.missingIngredients.length <= 3;
    })
    .slice(0, MAX_RECIPES_PER_GROUP);
}

export function parseRecipeSuggestion(value: unknown): RecipeSuggestion | null {
  if (!isRecord(value)) return null;

  const title = readString(value.title);
  const summary = readString(value.summary);
  const usedIngredients = readNamedAmounts(value.usedIngredients);
  const basicSeasonings = readStringArray(value.basicSeasonings);
  const missingIngredients = readNamedAmounts(value.missingIngredients);
  const preparationSteps = readPreparationSteps(value.preparationSteps);
  const cookingSteps = readStringArray(value.cookingSteps);
  const safetyNotes = readStringArray(value.safetyNotes);

  if (
    !title ||
    !summary ||
    !Number.isInteger(value.servings) ||
    !Number.isInteger(value.cookingMinutes) ||
    Number(value.cookingMinutes) < 1 ||
    usedIngredients.length === 0 ||
    preparationSteps.length === 0 ||
    cookingSteps.length === 0
  ) {
    return null;
  }

  return {
    title,
    summary,
    servings: Number(value.servings),
    cookingMinutes: Number(value.cookingMinutes),
    usedIngredients,
    basicSeasonings,
    missingIngredients,
    preparationSteps,
    cookingSteps,
    safetyNotes,
  };
}

function readNamedAmounts(value: unknown): NamedAmount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const name = readString(entry.name);
    const amount = readString(entry.amount);
    return name && amount ? [{ name, amount }] : [];
  });
}

function readPreparationSteps(value: unknown): PreparationStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const ingredientName = readString(entry.ingredientName);
    const instruction = readString(entry.instruction);
    return ingredientName && instruction ? [{ ingredientName, instruction }] : [];
  });
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const text = readString(entry);
        return text ? [text] : [];
      })
    : [];
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 500)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

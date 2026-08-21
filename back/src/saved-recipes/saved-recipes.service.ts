import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import {
  BASIC_SEASONINGS,
  RecipeSuggestion,
} from '../recipe-suggestions/recipe-suggestion';
import { parseRecipeSuggestion } from '../recipe-suggestions/recipe-suggestion-validator';
import { SavedRecipe } from './saved-recipe';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SavedRecipeRecord = {
  id: string;
  recipe: unknown;
  createdAt: Date;
};

@Injectable()
export class SavedRecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const recipes = await this.prisma.client.savedRecipe.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return recipes.map(mapSavedRecipe);
  }

  async create(input: unknown) {
    const recipe = validateSavedRecipeInput(input);
    const fingerprint = recipeFingerprint(recipe);
    const existing = await this.prisma.client.savedRecipe.findUnique({
      where: { fingerprint },
    });
    if (existing) return mapSavedRecipe(existing);

    try {
      const saved = await this.prisma.client.savedRecipe.create({
        data: {
          fingerprint,
          title: recipe.title,
          ingredientNames: ingredientNames(recipe),
          recipe: JSON.parse(JSON.stringify(recipe)),
        },
      });
      return mapSavedRecipe(saved);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrentlySaved = await this.prisma.client.savedRecipe.findUnique({
          where: { fingerprint },
        });
        if (concurrentlySaved) return mapSavedRecipe(concurrentlySaved);
      }
      throw error;
    }
  }

  async remove(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('유효한 저장 레시피 ID가 필요합니다.');
    }

    const removed = await this.prisma.client.savedRecipe.deleteMany({
      where: { id },
    });
    if (removed.count === 0) {
      throw new NotFoundException('저장한 레시피를 찾을 수 없습니다.');
    }
  }
}

export function validateSavedRecipeInput(input: unknown) {
  const recipe = parseRecipeSuggestion(input);
  if (
    !recipe ||
    recipe.servings < 1 ||
    recipe.servings > 6 ||
    recipe.cookingMinutes > 180 ||
    recipe.usedIngredients.length > 20 ||
    recipe.basicSeasonings.length > BASIC_SEASONINGS.length ||
    recipe.basicSeasonings.some(
      (seasoning) => !BASIC_SEASONINGS.includes(seasoning as never),
    ) ||
    recipe.missingIngredients.length > 3 ||
    recipe.preparationSteps.length > 20 ||
    recipe.cookingSteps.length > 20 ||
    recipe.safetyNotes.length > 10
  ) {
    throw new BadRequestException('저장할 레시피 정보를 확인해주세요.');
  }
  return recipe;
}

export function recipeFingerprint(recipe: RecipeSuggestion) {
  return createHash('sha256').update(JSON.stringify(recipe)).digest('hex');
}

function ingredientNames(recipe: RecipeSuggestion) {
  return [
    ...new Set(
      [...recipe.usedIngredients, ...recipe.missingIngredients].map(({ name }) =>
        name.trim().toLocaleLowerCase('ko-KR'),
      ),
    ),
  ];
}

function mapSavedRecipe(record: SavedRecipeRecord): SavedRecipe {
  return {
    id: record.id,
    recipe: record.recipe as RecipeSuggestion,
    createdAt: record.createdAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

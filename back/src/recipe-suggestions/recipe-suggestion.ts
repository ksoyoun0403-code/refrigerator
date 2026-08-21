export const BASIC_SEASONINGS = ['물', '소금', '후추', '식용유'] as const;

export type RecipeSuggestionRequest = {
  itemIds: string[];
  servings: number;
  maxCookingMinutes: number;
  assumeBasicSeasonings: boolean;
};

export type RecipeIngredientInput = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  expirationDate: string | null;
};

export type NamedAmount = {
  name: string;
  amount: string;
};

export type PreparationStep = {
  ingredientName: string;
  instruction: string;
};

export type RecipeSuggestion = {
  title: string;
  summary: string;
  servings: number;
  cookingMinutes: number;
  usedIngredients: NamedAmount[];
  basicSeasonings: string[];
  missingIngredients: NamedAmount[];
  preparationSteps: PreparationStep[];
  cookingSteps: string[];
  safetyNotes: string[];
};

export type RecipeSuggestionGroups = {
  availableOnly: RecipeSuggestion[];
  needsFewMore: RecipeSuggestion[];
};

export type RecipeSuggestionResponse = RecipeSuggestionGroups & {
  generatedAt: string;
};

export type RecipeGenerationInput = Omit<
  RecipeSuggestionRequest,
  'itemIds'
> & {
  ingredients: RecipeIngredientInput[];
};

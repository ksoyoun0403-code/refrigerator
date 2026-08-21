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

export type RecipeSuggestionResult = {
  availableOnly: RecipeSuggestion[];
  needsFewMore: RecipeSuggestion[];
  generatedAt: string;
};

export type SavedRecipe = {
  id: string;
  recipe: RecipeSuggestion;
  createdAt: string;
};

export type GenerateRecipeSuggestions = {
  itemIds: string[];
  servings: number;
  maxCookingMinutes: number;
  assumeBasicSeasonings: boolean;
};

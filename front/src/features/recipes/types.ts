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

export type RecipePostListItem = {
  id: string;
  author: { id: string | null; nickname: string };
  title: string;
  ingredientNames: string[];
  bookmarkCount: number;
  commentCount: number;
  isBookmarked: boolean;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeComment = {
  id: string;
  recipePostId: string;
  author: { id: string; nickname: string };
  content: string;
  isOwn: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeCommentPage = {
  items: RecipeComment[];
  nextCursor: string | null;
};

export type RecipePost = RecipePostListItem & {
  summary: string;
  recipe: RecipeSuggestion;
};

export type RecipeConsumptionPreviewLine = {
  id: string;
  ingredientName: string;
  recipeAmount: string;
  status: 'MATCHED' | 'INSUFFICIENT' | 'NOT_FOUND' | 'INCOMPATIBLE_UNIT' | 'UNSUPPORTED';
  itemId?: string;
  itemName?: string;
  unit?: string;
  currentQuantity?: string;
  suggestedQuantity?: string;
  remainingQuantity?: string;
  expirationDate?: string | null;
  message?: string;
  manualItems?: Array<{
    itemId: string;
    itemName: string;
    currentQuantity: string;
    unit: string;
    expirationDate: string | null;
  }>;
};

export type RecipeConsumptionPreview = {
  recipeTitle: string;
  lines: RecipeConsumptionPreviewLine[];
};

export type RecipeConsumptionResult = {
  recipeTitle: string;
  updatedItems: Array<{ id: string; name: string; quantity: string; unit: string; removed: boolean }>;
};

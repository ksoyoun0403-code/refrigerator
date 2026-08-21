import { RecipeSuggestion } from '../recipe-suggestions/recipe-suggestion';

export type SavedRecipe = {
  id: string;
  recipe: RecipeSuggestion;
  createdAt: string;
};

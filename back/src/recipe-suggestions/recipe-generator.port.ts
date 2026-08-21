import {
  RecipeGenerationInput,
  RecipeSuggestionGroups,
} from './recipe-suggestion';

export const RECIPE_GENERATOR = Symbol('RECIPE_GENERATOR');

export interface RecipeGenerator {
  generate(input: RecipeGenerationInput): Promise<RecipeSuggestionGroups>;
}

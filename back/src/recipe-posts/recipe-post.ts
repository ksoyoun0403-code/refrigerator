import { RecipeSuggestion } from '../recipe-suggestions/recipe-suggestion';

export type RecipePost = {
  id: string;
  author: {
    id: string;
    nickname: string;
  };
  title: string;
  summary: string;
  ingredientNames: string[];
  recipe: RecipeSuggestion;
  bookmarkCount: number;
  commentCount: number;
  isBookmarked: boolean;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipePostListItem = Omit<RecipePost, 'recipe' | 'summary'>;

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

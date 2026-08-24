CREATE TABLE "recipe_comments" (
    "id" UUID NOT NULL,
    "recipePostId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recipe_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_comments_recipePostId_createdAt_id_idx" ON "recipe_comments"("recipePostId", "createdAt", "id");
CREATE INDEX "recipe_comments_authorId_createdAt_idx" ON "recipe_comments"("authorId", "createdAt");

ALTER TABLE "recipe_comments" ADD CONSTRAINT "recipe_comments_recipePostId_fkey"
FOREIGN KEY ("recipePostId") REFERENCES "recipe_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_comments" ADD CONSTRAINT "recipe_comments_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

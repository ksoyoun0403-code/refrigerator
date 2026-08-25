-- CreateTable
CREATE TABLE "recipe_posts" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "ingredientNames" TEXT[],
    "recipe" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_bookmarks" (
    "userId" UUID NOT NULL,
    "recipePostId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_bookmarks_pkey" PRIMARY KEY ("userId", "recipePostId")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_posts_authorId_fingerprint_key" ON "recipe_posts"("authorId", "fingerprint");

-- CreateIndex
CREATE INDEX "recipe_posts_createdAt_idx" ON "recipe_posts"("createdAt");

-- CreateIndex
CREATE INDEX "recipe_posts_authorId_createdAt_idx" ON "recipe_posts"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "recipe_posts_ingredientNames_gin_idx" ON "recipe_posts" USING GIN ("ingredientNames");

-- CreateIndex
CREATE INDEX "recipe_bookmarks_recipePostId_idx" ON "recipe_bookmarks"("recipePostId");

-- CreateIndex
CREATE INDEX "recipe_bookmarks_userId_createdAt_idx" ON "recipe_bookmarks"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "recipe_posts" ADD CONSTRAINT "recipe_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bookmarks" ADD CONSTRAINT "recipe_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bookmarks" ADD CONSTRAINT "recipe_bookmarks_recipePostId_fkey" FOREIGN KEY ("recipePostId") REFERENCES "recipe_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

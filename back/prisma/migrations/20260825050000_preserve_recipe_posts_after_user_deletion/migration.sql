ALTER TABLE "recipe_posts"
DROP CONSTRAINT "recipe_posts_authorId_fkey";

ALTER TABLE "recipe_posts"
ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE "recipe_posts"
ADD CONSTRAINT "recipe_posts_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

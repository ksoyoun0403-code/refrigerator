-- Preserve the pre-community SavedRecipe data as posts owned by the oldest
-- existing user. On a fresh database or when no user exists this is a no-op.
INSERT INTO "recipe_posts" (
    "id",
    "authorId",
    "fingerprint",
    "title",
    "summary",
    "ingredientNames",
    "recipe",
    "createdAt",
    "updatedAt"
)
SELECT
    saved."id",
    owner."id",
    saved."fingerprint",
    saved."title",
    LEFT(COALESCE(saved."recipe"->>'summary', ''), 300),
    saved."ingredientNames",
    saved."recipe",
    saved."createdAt",
    saved."updatedAt"
FROM "saved_recipes" AS saved
CROSS JOIN LATERAL (
    SELECT "id"
    FROM "users"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS owner
ON CONFLICT ("authorId", "fingerprint") DO NOTHING;

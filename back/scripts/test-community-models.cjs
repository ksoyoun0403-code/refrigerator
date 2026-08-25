const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

const database = new Client({ connectionString: process.env.DATABASE_URL });
const authorId = randomUUID();
const readerId = randomUUID();
const postId = randomUUID();

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  await database.connect();
  await database.query('BEGIN');

  await createUser(authorId, 'community-author');
  await createUser(readerId, 'community-reader');
  await database.query(
    `INSERT INTO recipe_posts
      (id, "authorId", fingerprint, title, summary, "ingredientNames", recipe, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())`,
    [
      postId,
      authorId,
      'a'.repeat(64),
      '당근 샐러드',
      '당근으로 만드는 간단한 샐러드',
      ['당근', '소금'],
      JSON.stringify({ title: '당근 샐러드' }),
    ],
  );
  await database.query(
    'INSERT INTO recipe_bookmarks ("userId", "recipePostId") VALUES ($1, $2)',
    [readerId, postId],
  );

  await database.query('SAVEPOINT duplicate_bookmark');
  await assert.rejects(
    database.query(
      'INSERT INTO recipe_bookmarks ("userId", "recipePostId") VALUES ($1, $2)',
      [readerId, postId],
    ),
    (error) => error.code === '23505',
  );
  await database.query('ROLLBACK TO SAVEPOINT duplicate_bookmark');

  await database.query('SAVEPOINT duplicate_post');
  await assert.rejects(
    database.query(
      `INSERT INTO recipe_posts
        (id, "authorId", fingerprint, title, summary, "ingredientNames", recipe, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, '중복', '중복', ARRAY[]::text[], '{}'::jsonb, NOW(), NOW())`,
      [randomUUID(), authorId, 'a'.repeat(64)],
    ),
    (error) => error.code === '23505',
  );
  await database.query('ROLLBACK TO SAVEPOINT duplicate_post');

  const bookmarkCount = await database.query(
    'SELECT COUNT(*)::int AS count FROM recipe_bookmarks WHERE "recipePostId" = $1',
    [postId],
  );
  assert.equal(bookmarkCount.rows[0].count, 1);

  await database.query('DELETE FROM recipe_posts WHERE id = $1', [postId]);
  const afterPostDelete = await database.query(
    'SELECT COUNT(*)::int AS count FROM recipe_bookmarks WHERE "recipePostId" = $1',
    [postId],
  );
  assert.equal(afterPostDelete.rows[0].count, 0);

  console.log('Recipe post uniqueness, bookmark uniqueness, and cascade test passed.');
}

async function createUser(id, suffix) {
  const shortId = id.slice(0, 8);
  await database.query(
    `INSERT INTO users
      (id, "loginId", "loginIdKey", nickname, "nicknameKey", "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, $2, $2, $3, $3, 'test-only', NOW(), NOW())`,
    [id, `${suffix}-${shortId}`, `테스트-${shortId}`],
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.query('ROLLBACK');
    await database.end();
  });

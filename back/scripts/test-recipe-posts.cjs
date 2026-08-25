const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const port = 3102;
const baseUrl = `http://127.0.0.1:${port}/v1`;
const database = new Client({ connectionString: process.env.DATABASE_URL });
let server;
let userId;
let readerId;

const recipe = {
  title: '당근 샐러드',
  summary: '당근을 활용한 간단한 샐러드',
  servings: 2,
  cookingMinutes: 15,
  usedIngredients: [{ name: '당근', amount: '1개' }],
  basicSeasonings: ['소금'],
  missingIngredients: [],
  preparationSteps: [{ ingredientName: '당근', instruction: '깨끗이 씻어 채 썬다.' }],
  cookingSteps: ['당근에 소금을 넣어 버무린다.'],
  safetyNotes: ['재료 상태를 확인한다.'],
};

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test backend did not start in time.');
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  await database.connect();
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();

  const suffix = Date.now();
  const registerResponse = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: `posttest${suffix}`,
      password: 'recipe-post-test-password!',
      nickname: `게시자${suffix}`,
    }),
  });
  const registerBody = await registerResponse.text();
  assert.equal(registerResponse.status, 201, registerBody);
  const session = JSON.parse(registerBody);
  userId = session.user.id;
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  const readerRegisterResponse = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: `reader${suffix}`,
      password: 'recipe-post-test-password!',
      nickname: `독자${suffix}`,
    }),
  });
  const readerRegisterBody = await readerRegisterResponse.text();
  assert.equal(readerRegisterResponse.status, 201, readerRegisterBody);
  const readerSession = JSON.parse(readerRegisterBody);
  readerId = readerSession.user.id;
  const readerHeaders = {
    Authorization: `Bearer ${readerSession.accessToken}`,
    'Content-Type': 'application/json',
  };

  const firstResponse = await fetch(`${baseUrl}/recipe-posts`, {
    method: 'POST', headers, body: JSON.stringify(recipe),
  });
  const firstBody = await firstResponse.text();
  assert.equal(firstResponse.status, 201, firstBody);
  const first = JSON.parse(firstBody);
  assert.equal(first.author.id, userId);
  assert.equal(first.author.nickname, session.user.nickname);
  assert.equal(first.bookmarkCount, 0);
  assert.equal(first.isBookmarked, false);
  assert.deepEqual(first.ingredientNames, ['당근']);

  const duplicateResponse = await fetch(`${baseUrl}/recipe-posts`, {
    method: 'POST', headers, body: JSON.stringify(recipe),
  });
  const duplicateBody = await duplicateResponse.text();
  assert.equal(duplicateResponse.status, 201, duplicateBody);
  assert.equal(JSON.parse(duplicateBody).id, first.id);

  const count = await database.query(
    'SELECT COUNT(*)::int AS count FROM recipe_posts WHERE "authorId" = $1',
    [userId],
  );
  assert.equal(count.rows[0].count, 1);

  const selfBookmarkResponse = await fetch(
    `${baseUrl}/recipe-posts/${first.id}/bookmark`,
    { method: 'POST', headers },
  );
  assert.equal(selfBookmarkResponse.status, 409);

  const bookmarkResponse = await fetch(
    `${baseUrl}/recipe-posts/${first.id}/bookmark`,
    { method: 'POST', headers: readerHeaders },
  );
  const bookmarkBody = await bookmarkResponse.text();
  assert.equal(bookmarkResponse.status, 201, bookmarkBody);
  const bookmarked = JSON.parse(bookmarkBody);
  assert.equal(bookmarked.bookmarkCount, 1);
  assert.equal(bookmarked.isBookmarked, true);

  const duplicateBookmarkResponse = await fetch(
    `${baseUrl}/recipe-posts/${first.id}/bookmark`,
    { method: 'POST', headers: readerHeaders },
  );
  const duplicateBookmarkBody = await duplicateBookmarkResponse.text();
  assert.equal(duplicateBookmarkResponse.status, 201, duplicateBookmarkBody);
  assert.equal(JSON.parse(duplicateBookmarkBody).bookmarkCount, 1);

  const listResponse = await fetch(`${baseUrl}/recipe-posts`, {
    headers: readerHeaders,
  });
  const listBody = await listResponse.text();
  assert.equal(listResponse.status, 200, listBody);
  const list = JSON.parse(listBody);
  const listedPost = list.find(({ id }) => id === first.id);
  assert.ok(listedPost);
  assert.equal(listedPost.author.nickname, session.user.nickname);
  assert.equal(listedPost.bookmarkCount, 1);
  assert.equal(listedPost.isBookmarked, true);
  assert.equal(listedPost.isOwn, false);
  assert.equal('recipe' in listedPost, false);
  assert.equal('summary' in listedPost, false);

  const ownListResponse = await fetch(`${baseUrl}/recipe-posts`, { headers });
  const ownListedPost = (await ownListResponse.json()).find(({ id }) => id === first.id);
  assert.equal(ownListedPost.isOwn, true);
  assert.equal(ownListedPost.isBookmarked, false);

  const titleSearchResponse = await fetch(
    `${baseUrl}/recipe-posts?q=${encodeURIComponent(recipe.title.slice(0, 2))}`,
    { headers: readerHeaders },
  );
  assert.equal(titleSearchResponse.status, 200);
  assert.ok((await titleSearchResponse.json()).some(({ id }) => id === first.id));

  const ingredientSearchResponse = await fetch(
    `${baseUrl}/recipe-posts?q=${encodeURIComponent(recipe.usedIngredients[0].name.slice(0, -1))}`,
    { headers: readerHeaders },
  );
  assert.equal(ingredientSearchResponse.status, 200);
  assert.ok((await ingredientSearchResponse.json()).some(({ id }) => id === first.id));

  const emptySearchResponse = await fetch(
    `${baseUrl}/recipe-posts?q=${encodeURIComponent('ingredient-that-does-not-exist')}`,
    { headers: readerHeaders },
  );
  assert.deepEqual(await emptySearchResponse.json(), []);

  const detailResponse = await fetch(`${baseUrl}/recipe-posts/${first.id}`, {
    headers: readerHeaders,
  });
  const detailBody = await detailResponse.text();
  assert.equal(detailResponse.status, 200, detailBody);
  const detail = JSON.parse(detailBody);
  assert.deepEqual(detail.recipe, recipe);
  assert.equal(detail.summary, recipe.summary);
  assert.equal(detail.isBookmarked, true);
  assert.equal(detail.isOwn, false);

  const mineResponse = await fetch(`${baseUrl}/recipe-posts/mine`, { headers });
  const mineBody = await mineResponse.text();
  assert.equal(mineResponse.status, 200, mineBody);
  assert.ok(JSON.parse(mineBody).some(({ id, isOwn }) => id === first.id && isOwn));

  const bookmarkedResponse = await fetch(`${baseUrl}/recipe-posts/bookmarked`, {
    headers: readerHeaders,
  });
  const bookmarkedBody = await bookmarkedResponse.text();
  assert.equal(bookmarkedResponse.status, 200, bookmarkedBody);
  assert.ok(JSON.parse(bookmarkedBody).some(({ id, isBookmarked }) => id === first.id && isBookmarked));

  const searchedMineResponse = await fetch(
    `${baseUrl}/recipe-posts/mine?q=${encodeURIComponent(recipe.title.slice(0, 2))}`,
    { headers },
  );
  assert.ok((await searchedMineResponse.json()).some(({ id }) => id === first.id));

  const searchedBookmarksResponse = await fetch(
    `${baseUrl}/recipe-posts/bookmarked?q=${encodeURIComponent(recipe.usedIngredients[0].name.slice(0, -1))}`,
    { headers: readerHeaders },
  );
  assert.ok((await searchedBookmarksResponse.json()).some(({ id }) => id === first.id));

  const emptyCookbookSearchResponse = await fetch(
    `${baseUrl}/recipe-posts/mine?q=${encodeURIComponent('cookbook-result-does-not-exist')}`,
    { headers },
  );
  assert.deepEqual(await emptyCookbookSearchResponse.json(), []);

  const forbiddenDeleteResponse = await fetch(`${baseUrl}/recipe-posts/${first.id}`, {
    method: 'DELETE', headers: readerHeaders,
  });
  assert.equal(forbiddenDeleteResponse.status, 403);

  const disposableRecipe = { ...recipe, title: `${recipe.title} delete test` };
  const disposableResponse = await fetch(`${baseUrl}/recipe-posts`, {
    method: 'POST', headers, body: JSON.stringify(disposableRecipe),
  });
  const disposable = await disposableResponse.json();
  const caseInsensitiveSearchResponse = await fetch(
    `${baseUrl}/recipe-posts?q=${encodeURIComponent('DELETE TEST')}`,
    { headers: readerHeaders },
  );
  assert.ok((await caseInsensitiveSearchResponse.json()).some(({ id }) => id === disposable.id));
  await fetch(`${baseUrl}/recipe-posts/${disposable.id}/bookmark`, {
    method: 'POST', headers: readerHeaders,
  });
  const deleteOwnResponse = await fetch(`${baseUrl}/recipe-posts/${disposable.id}`, {
    method: 'DELETE', headers,
  });
  assert.equal(deleteOwnResponse.status, 204);
  const deletedBookmarkRows = await database.query(
    'SELECT COUNT(*)::int AS count FROM recipe_bookmarks WHERE "recipePostId" = $1',
    [disposable.id],
  );
  assert.equal(deletedBookmarkRows.rows[0].count, 0);
  const deletedDetailResponse = await fetch(`${baseUrl}/recipe-posts/${disposable.id}`, {
    headers,
  });
  assert.equal(deletedDetailResponse.status, 404);

  const invalidDetailResponse = await fetch(`${baseUrl}/recipe-posts/not-a-uuid`, {
    headers: readerHeaders,
  });
  assert.equal(invalidDetailResponse.status, 400);

  const bookmarkRows = await database.query(
    'SELECT COUNT(*)::int AS count FROM recipe_bookmarks WHERE "recipePostId" = $1',
    [first.id],
  );
  assert.equal(bookmarkRows.rows[0].count, 1);

  const removeBookmarkResponse = await fetch(
    `${baseUrl}/recipe-posts/${first.id}/bookmark`,
    { method: 'DELETE', headers: readerHeaders },
  );
  assert.equal(removeBookmarkResponse.status, 204);
  const afterRemove = await database.query(
    'SELECT COUNT(*)::int AS count FROM recipe_bookmarks WHERE "recipePostId" = $1',
    [first.id],
  );
  assert.equal(afterRemove.rows[0].count, 0);

  const duplicateRemoveResponse = await fetch(
    `${baseUrl}/recipe-posts/${first.id}/bookmark`,
    { method: 'DELETE', headers: readerHeaders },
  );
  assert.equal(duplicateRemoveResponse.status, 204);

  const invalidIdResponse = await fetch(`${baseUrl}/recipe-posts/not-a-uuid/bookmark`, {
    method: 'POST', headers: readerHeaders,
  });
  assert.equal(invalidIdResponse.status, 400);

  console.log('Recipe sharing, community, cookbook management, and bookmark API test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server && server.exitCode === null) server.kill();
    if (userId) await database.query('DELETE FROM users WHERE id = $1', [userId]);
    if (readerId) await database.query('DELETE FROM users WHERE id = $1', [readerId]);
    await database.end();
  });

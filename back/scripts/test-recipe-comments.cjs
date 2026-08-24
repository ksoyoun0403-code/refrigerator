const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const port = 3103;
const baseUrl = `http://127.0.0.1:${port}/v1`;
const database = new Client({ connectionString: process.env.DATABASE_URL });
let server;
const userIds = [];

const recipe = {
  title: '댓글 테스트 레시피', summary: '댓글 API 검증용', servings: 1, cookingMinutes: 5,
  usedIngredients: [{ name: '토마토', amount: '1개' }], basicSeasonings: [], missingIngredients: [],
  preparationSteps: [{ ingredientName: '토마토', instruction: '씻는다.' }],
  cookingSteps: ['접시에 담는다.'], safetyNotes: ['상태를 확인한다.'],
};

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test backend did not start in time.');
}

async function register(label, suffix) {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: `${label}${suffix}`, password: 'comment-test-password!', nickname: `${label === 'commentauthor' ? '작성자' : '독자'}${String(suffix).slice(-6)}` }),
  });
  const body = await response.text();
  assert.equal(response.status, 201, body);
  const session = JSON.parse(body);
  userIds.push(session.user.id);
  return { session, headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' } };
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  await database.connect();
  server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await waitForServer();
  const suffix = Date.now();
  const author = await register('commentauthor', suffix);
  const reader = await register('commentreader', suffix);

  const postResponse = await fetch(`${baseUrl}/recipe-posts`, { method: 'POST', headers: author.headers, body: JSON.stringify(recipe) });
  const post = await postResponse.json();
  assert.equal(postResponse.status, 201);
  assert.equal(post.commentCount, 0);

  const emptyResponse = await fetch(`${baseUrl}/recipe-posts/${post.id}/comments`, { headers: reader.headers });
  assert.deepEqual(await emptyResponse.json(), { items: [], nextCursor: null });

  const createResponse = await fetch(`${baseUrl}/recipe-posts/${post.id}/comments`, { method: 'POST', headers: reader.headers, body: JSON.stringify({ content: '  맛있어 보여요!  ' }) });
  const comment = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(comment.content, '맛있어 보여요!');
  assert.equal(comment.isOwn, true);
  assert.equal(comment.author.id, reader.session.user.id);

  const detail = await (await fetch(`${baseUrl}/recipe-posts/${post.id}`, { headers: author.headers })).json();
  assert.equal(detail.commentCount, 1);
  const page = await (await fetch(`${baseUrl}/recipe-posts/${post.id}/comments?limit=1`, { headers: author.headers })).json();
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].isOwn, false);

  const forbiddenUpdate = await fetch(`${baseUrl}/recipe-comments/${comment.id}`, { method: 'PATCH', headers: author.headers, body: JSON.stringify({ content: '수정 시도' }) });
  assert.equal(forbiddenUpdate.status, 403);
  const updateResponse = await fetch(`${baseUrl}/recipe-comments/${comment.id}`, { method: 'PATCH', headers: reader.headers, body: JSON.stringify({ content: '수정한 댓글' }) });
  assert.equal((await updateResponse.json()).content, '수정한 댓글');

  const invalidResponse = await fetch(`${baseUrl}/recipe-posts/${post.id}/comments`, { method: 'POST', headers: reader.headers, body: JSON.stringify({ content: ' '.repeat(3) }) });
  assert.equal(invalidResponse.status, 400);
  const forbiddenDelete = await fetch(`${baseUrl}/recipe-comments/${comment.id}`, { method: 'DELETE', headers: author.headers });
  assert.equal(forbiddenDelete.status, 403);
  const deleteResponse = await fetch(`${baseUrl}/recipe-comments/${comment.id}`, { method: 'DELETE', headers: reader.headers });
  assert.equal(deleteResponse.status, 204);

  const second = await (await fetch(`${baseUrl}/recipe-posts/${post.id}/comments`, { method: 'POST', headers: reader.headers, body: JSON.stringify({ content: '연쇄 삭제 확인' }) })).json();
  assert.ok(second.id);
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM recipe_comments WHERE "recipePostId" = $1', [post.id])).rows[0].count, 1);
  assert.equal((await fetch(`${baseUrl}/recipe-posts/${post.id}`, { method: 'DELETE', headers: author.headers })).status, 204);
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM recipe_comments WHERE "recipePostId" = $1', [post.id])).rows[0].count, 0);
  console.log('Recipe comments API test passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) server.kill();
  for (const id of userIds) await database.query('DELETE FROM users WHERE id = $1', [id]);
  await database.end();
});

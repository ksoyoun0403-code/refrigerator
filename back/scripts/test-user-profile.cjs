const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const port = 3104;
const baseUrl = `http://127.0.0.1:${port}/v1`;
const database = new Client({ connectionString: process.env.DATABASE_URL });
const userIds = [];
const postIds = [];
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test backend did not start in time.');
}

async function register(loginId, nickname) {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, nickname, password: 'profile-test-password!' }),
  });
  const body = await response.text();
  assert.equal(response.status, 201, body);
  const session = JSON.parse(body);
  userIds.push(session.user.id);
  return session;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  await database.connect();
  server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await waitForServer();
  const suffix = String(Date.now()).slice(-8);
  const first = await register(`profilea${suffix}`, `기존닉${suffix}`);
  const second = await register(`profileb${suffix}`, `중복닉${suffix}`);
  const headers = { Authorization: `Bearer ${first.accessToken}`, 'Content-Type': 'application/json' };

  const updateResponse = await fetch(`${baseUrl}/users/me`, {
    method: 'PATCH', headers, body: JSON.stringify({ nickname: ` 새닉${suffix} ` }),
  });
  const updated = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updated.nickname, `새닉${suffix}`);
  assert.equal(updated.id, first.user.id);

  const me = await (await fetch(`${baseUrl}/auth/me`, { headers })).json();
  assert.equal(me.nickname, `새닉${suffix}`);
  const duplicateResponse = await fetch(`${baseUrl}/users/me`, {
    method: 'PATCH', headers, body: JSON.stringify({ nickname: second.user.nickname }),
  });
  assert.equal(duplicateResponse.status, 409);
  const invalidResponse = await fetch(`${baseUrl}/users/me`, {
    method: 'PATCH', headers, body: JSON.stringify({ nickname: '닉' }),
  });
  assert.equal(invalidResponse.status, 400);

  const recipe = {
    title: `탈퇴 보존 레시피 ${suffix}`,
    summary: '탈퇴 후 익명으로 남아야 하는 테스트 레시피',
    servings: 2,
    cookingMinutes: 20,
    usedIngredients: [{ name: '두부', amount: '1모' }],
    basicSeasonings: ['소금'],
    missingIngredients: [],
    preparationSteps: [{ ingredientName: '두부', instruction: '물기를 제거한다.' }],
    cookingSteps: ['팬에서 충분히 익힌다.'],
    safetyNotes: ['재료 상태를 확인한다.'],
  };
  const postResponse = await fetch(`${baseUrl}/recipe-posts`, {
    method: 'POST', headers, body: JSON.stringify(recipe),
  });
  const postBody = await postResponse.text();
  assert.equal(postResponse.status, 201, postBody);
  const post = JSON.parse(postBody);
  postIds.push(post.id);

  const deleteResponse = await fetch(`${baseUrl}/users/me`, {
    method: 'DELETE', headers,
  });
  assert.equal(deleteResponse.status, 204, await deleteResponse.text());
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM users WHERE id = $1', [first.user.id])).rows[0].count, 0);
  assert.equal((await database.query('SELECT "authorId" FROM recipe_posts WHERE id = $1', [post.id])).rows[0].authorId, null);

  const readerHeaders = { Authorization: `Bearer ${second.accessToken}` };
  const preserved = await (await fetch(`${baseUrl}/recipe-posts/${post.id}`, { headers: readerHeaders })).json();
  assert.equal(preserved.author.id, null);
  assert.equal(preserved.author.nickname, '익명');
  assert.equal(preserved.isOwn, false);
  assert.equal((await fetch(`${baseUrl}/auth/me`, { headers })).status, 401);

  console.log('User profile and account deletion API test passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) server.kill();
  for (const id of postIds) await database.query('DELETE FROM recipe_posts WHERE id = $1', [id]);
  for (const id of userIds) await database.query('DELETE FROM users WHERE id = $1', [id]);
  await database.end();
});

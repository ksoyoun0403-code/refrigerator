const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}/v1`;
const scanId = randomUUID();
const sortingFixtures = [
  { id: randomUUID(), scanId: randomUUID(), name: 'use-soon-second', section: 'USE_SOON', sortOrder: 2, expirationDate: '2099-01-01', purchasedAt: '2026-01-01' },
  { id: randomUUID(), scanId: randomUUID(), name: 'use-soon-first', section: 'USE_SOON', sortOrder: 0, expirationDate: '2099-02-01', purchasedAt: '2026-02-01' },
  { id: randomUUID(), scanId: randomUUID(), name: 'same-date-later-purchase', section: 'DEFAULT', sortOrder: 0, expirationDate: '2099-03-01', purchasedAt: '2026-02-01' },
  { id: randomUUID(), scanId: randomUUID(), name: 'same-date-earlier-purchase', section: 'DEFAULT', sortOrder: 0, expirationDate: '2099-03-01', purchasedAt: '2026-01-01' },
  { id: randomUUID(), scanId: randomUUID(), name: 'later-expiration', section: 'DEFAULT', sortOrder: 0, expirationDate: '2099-04-01', purchasedAt: '2025-01-01' },
  { id: randomUUID(), scanId: randomUUID(), name: 'no-expiration-older-purchase', section: 'DEFAULT', sortOrder: 0, expirationDate: null, purchasedAt: '2025-01-01' },
  { id: randomUUID(), scanId: randomUUID(), name: 'no-expiration-newer-purchase', section: 'DEFAULT', sortOrder: 0, expirationDate: null, purchasedAt: '2025-02-01' },
];
const allScanIds = [scanId, ...sortingFixtures.map((fixture) => fixture.scanId)];
const database = new Client({ connectionString: process.env.DATABASE_URL });
let server;
let databaseConnected = false;
let testUserId;
let otherUserId;
let accessToken;

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

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

async function insertSortingFixtures() {
  for (const fixture of sortingFixtures) {
    await database.query(
      `INSERT INTO expiration_scans
        (id, "userId", status, "createdAt", "updatedAt")
       VALUES ($1, $2, 'CONFIRMED', NOW(), NOW())`,
      [fixture.scanId, testUserId],
    );
    await database.query(
      `INSERT INTO expiration_items
        (id, "userId", "scanId", name, quantity, unit, "purchasedAt", "expirationDate",
         source, section, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 1, 'COUNT', $5::date, $6::date,
         'IMAGE', $7::"ExpirationItemSection", $8, NOW(), NOW())`,
      [
        fixture.id,
        testUserId,
        fixture.scanId,
        fixture.name,
        fixture.purchasedAt,
        fixture.expirationDate,
        fixture.section,
        fixture.sortOrder,
      ],
    );
  }
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  await database.connect();
  databaseConnected = true;

  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverError = '';
  server.stderr.on('data', (chunk) => { serverError += chunk.toString(); });
  await waitForServer();

  const suffix = Date.now();
  const registerResponse = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: `dbtest${suffix}`,
      password: 'database-test-password!',
      nickname: `DB테스트${suffix}`,
    }),
  });
  const registerBody = await registerResponse.text();
  assert.equal(registerResponse.status, 201, registerBody);
  const session = JSON.parse(registerBody);
  testUserId = session.user.id;
  accessToken = session.accessToken;

  const otherRegisterResponse = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: `dbother${suffix}`,
      password: 'database-test-password!',
      nickname: `다른사용자${suffix}`,
    }),
  });
  const otherRegisterBody = await otherRegisterResponse.text();
  assert.equal(otherRegisterResponse.status, 201, otherRegisterBody);
  const otherSession = JSON.parse(otherRegisterBody);
  otherUserId = otherSession.user.id;

  await database.query(
    `INSERT INTO expiration_scans
      (id, "userId", status, "createdAt", "updatedAt")
     VALUES ($1, $2, 'NEEDS_REVIEW', NOW(), NOW())`,
    [scanId, testUserId],
  );

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const createResponse = await fetch(`${baseUrl}/expiration-items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      scanId,
      name: 'DB 연동 테스트 식재료',
      quantity: '1.5',
      unit: 'KG',
      expirationDate: null,
    }),
  });
  const createBody = await createResponse.text();
  assert.equal(createResponse.status, 201, createBody);
  const created = JSON.parse(createBody);
  assert.equal(created.scanId, scanId);
  assert.equal(created.quantity, '1.5');
  assert.equal(created.unit, 'KG');
  assert.equal(created.expirationDate, null);
  assert.equal(created.purchasedAt, todayInSeoul());

  const otherListResponse = await fetch(`${baseUrl}/expiration-items`, {
    headers: { Authorization: `Bearer ${otherSession.accessToken}` },
  });
  assert.equal(otherListResponse.status, 200);
  const otherItems = await otherListResponse.json();
  assert.equal(otherItems.some((item) => item.id === created.id), false);

  const forbiddenUpdateResponse = await fetch(
    `${baseUrl}/expiration-items/${created.id}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${otherSession.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '다른 사용자의 수정 시도' }),
    },
  );
  assert.equal(forbiddenUpdateResponse.status, 404);

  const forbiddenDeleteResponse = await fetch(
    `${baseUrl}/expiration-items/${created.id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherSession.accessToken}` },
    },
  );
  assert.equal(forbiddenDeleteResponse.status, 404);

  const forbiddenRecipeResponse = await fetch(`${baseUrl}/recipe-suggestions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${otherSession.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemIds: [created.id],
      servings: 2,
      maxCookingMinutes: 30,
      assumeBasicSeasonings: true,
    }),
  });
  assert.equal(forbiddenRecipeResponse.status, 404);

  const updateResponse = await fetch(
    `${baseUrl}/expiration-items/${created.id}`,
    {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        name: '수정된 DB 연동 식재료',
        quantity: '2',
        unit: 'PACK',
        purchasedAt: '2026-08-01',
        expirationDate: '2026-08-31',
      }),
    },
  );
  const updateBody = await updateResponse.text();
  assert.equal(updateResponse.status, 200, updateBody);
  const updated = JSON.parse(updateBody);
  assert.equal(updated.name, '수정된 DB 연동 식재료');
  assert.equal(updated.quantity, '2');
  assert.equal(updated.unit, 'PACK');
  assert.equal(updated.purchasedAt, '2026-08-01');
  assert.equal(updated.expirationDate, '2026-08-31');

  const duplicateResponse = await fetch(`${baseUrl}/expiration-items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      scanId,
      name: '중복 등록',
      quantity: '1',
      unit: 'COUNT',
      expirationDate: null,
    }),
  });
  assert.equal(duplicateResponse.status, 409);

  await insertSortingFixtures();
  const itemToMove = sortingFixtures.find(
    (fixture) => fixture.name === 'later-expiration',
  );
  const moveResponse = await fetch(
    `${baseUrl}/expiration-items/${itemToMove.id}`,
    {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ section: 'USE_SOON' }),
    },
  );
  const moveBody = await moveResponse.text();
  assert.equal(moveResponse.status, 200, moveBody);
  const moved = JSON.parse(moveBody);
  assert.equal(moved.section, 'USE_SOON');
  assert.equal(moved.sortOrder, 3);

  const listResponse = await fetch(`${baseUrl}/expiration-items`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(listResponse.status, 200);
  const items = await listResponse.json();
  assert.ok(items.some((item) => item.id === created.id));
  const fixtureIds = new Set(sortingFixtures.map((fixture) => fixture.id));
  const sortedFixtureNames = items
    .filter((item) => fixtureIds.has(item.id))
    .map((item) => item.name);
  assert.deepEqual(sortedFixtureNames, [
    'use-soon-second',
    'use-soon-first',
    'later-expiration',
    'same-date-earlier-purchase',
    'same-date-later-purchase',
    'no-expiration-older-purchase',
    'no-expiration-newer-purchase',
  ]);

  const deleteResponse = await fetch(
    `${baseUrl}/expiration-items/${created.id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  assert.equal(deleteResponse.status, 204);

  const remainingItems = await database.query(
    'SELECT COUNT(*)::int AS count FROM expiration_items WHERE "scanId" = $1',
    [scanId],
  );
  const remainingScans = await database.query(
    'SELECT COUNT(*)::int AS count FROM expiration_scans WHERE id = $1',
    [scanId],
  );
  assert.equal(remainingItems.rows[0].count, 0);
  assert.equal(remainingScans.rows[0].count, 0);

  const wrongPasswordChangeResponse = await fetch(`${baseUrl}/auth/password`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'wrong-password!',
      newPassword: 'changed-database-password!',
    }),
  });
  assert.equal(wrongPasswordChangeResponse.status, 401);

  const passwordChangeResponse = await fetch(`${baseUrl}/auth/password`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'database-test-password!',
      newPassword: 'changed-database-password!',
    }),
  });
  assert.equal(passwordChangeResponse.status, 204);

  const revokedAccessResponse = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(revokedAccessResponse.status, 401);

  const revokedRefreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  assert.equal(revokedRefreshResponse.status, 401);

  const oldPasswordLoginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: session.user.loginId, password: 'database-test-password!' }),
  });
  assert.equal(oldPasswordLoginResponse.status, 401);

  const newPasswordLoginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: session.user.loginId, password: 'changed-database-password!' }),
  });
  assert.equal(newPasswordLoginResponse.status, 200);

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(serverError || `Backend exited with ${server.exitCode}.`);
  }
  console.log('Database integration, ownership, expiration sorting, and password revocation test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server && server.exitCode === null) server.kill();
    if (databaseConnected && testUserId) {
      await database.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } else if (databaseConnected) {
      await database.query(
        'DELETE FROM expiration_items WHERE "scanId" = ANY($1::uuid[])',
        [allScanIds],
      );
      await database.query(
        'DELETE FROM expiration_scans WHERE id = ANY($1::uuid[])',
        [allScanIds],
      );
    }
    if (databaseConnected && otherUserId) {
      await database.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    }
    if (databaseConnected) await database.end();
  });

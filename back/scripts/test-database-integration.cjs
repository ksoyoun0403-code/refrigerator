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
      const response = await fetch(`${baseUrl}/expiration-items`);
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
        (id, status, "createdAt", "updatedAt")
       VALUES ($1, 'CONFIRMED', NOW(), NOW())`,
      [fixture.scanId],
    );
    await database.query(
      `INSERT INTO expiration_items
        (id, "scanId", name, quantity, unit, "purchasedAt", "expirationDate",
         source, section, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 1, 'COUNT', $4::date, $5::date,
         'IMAGE', $6::"ExpirationItemSection", $7, NOW(), NOW())`,
      [
        fixture.id,
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
  await database.query(
    `INSERT INTO expiration_scans
      (id, status, "createdAt", "updatedAt")
     VALUES ($1, 'NEEDS_REVIEW', NOW(), NOW())`,
    [scanId],
  );

  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverError = '';
  server.stderr.on('data', (chunk) => { serverError += chunk.toString(); });
  await waitForServer();

  const createResponse = await fetch(`${baseUrl}/expiration-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const updateResponse = await fetch(
    `${baseUrl}/expiration-items/${created.id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'USE_SOON' }),
    },
  );
  const moveBody = await moveResponse.text();
  assert.equal(moveResponse.status, 200, moveBody);
  const moved = JSON.parse(moveBody);
  assert.equal(moved.section, 'USE_SOON');
  assert.equal(moved.sortOrder, 3);

  const listResponse = await fetch(`${baseUrl}/expiration-items`);
  assert.equal(listResponse.status, 200);
  const items = await listResponse.json();
  assert.ok(items.some((item) => item.id === created.id));
  const fixtureIds = new Set(sortingFixtures.map((fixture) => fixture.id));
  const sortedFixtureNames = items
    .filter((item) => fixtureIds.has(item.id))
    .map((item) => item.name);
  assert.deepEqual(sortedFixtureNames, [
    'use-soon-first',
    'use-soon-second',
    'later-expiration',
    'same-date-earlier-purchase',
    'same-date-later-purchase',
    'no-expiration-older-purchase',
    'no-expiration-newer-purchase',
  ]);

  const deleteResponse = await fetch(
    `${baseUrl}/expiration-items/${created.id}`,
    { method: 'DELETE' },
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

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(serverError || `Backend exited with ${server.exitCode}.`);
  }
  console.log('Database integration, update, move, and sorting test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server && server.exitCode === null) server.kill();
    if (databaseConnected) {
      await database.query(
        'DELETE FROM expiration_items WHERE "scanId" = ANY($1::uuid[])',
        [allScanIds],
      );
      await database.query(
        'DELETE FROM expiration_scans WHERE id = ANY($1::uuid[])',
        [allScanIds],
      );
      await database.end();
    }
  });

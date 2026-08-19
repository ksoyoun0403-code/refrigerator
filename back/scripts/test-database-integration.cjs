const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}/v1`;
const scanId = randomUUID();
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

  const listResponse = await fetch(`${baseUrl}/expiration-items`);
  assert.equal(listResponse.status, 200);
  const items = await listResponse.json();
  assert.ok(items.some((item) => item.id === created.id));

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
  console.log('Database integration test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server && server.exitCode === null) server.kill();
    if (databaseConnected) {
      await database.query('DELETE FROM expiration_items WHERE "scanId" = $1', [scanId]);
      await database.query('DELETE FROM expiration_scans WHERE id = $1', [scanId]);
      await database.end();
    }
  });

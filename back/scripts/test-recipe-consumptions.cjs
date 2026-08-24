const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const port = 3104;
const baseUrl = `http://127.0.0.1:${port}/v1`;
const database = new Client({ connectionString: process.env.DATABASE_URL });
let server;
const userIds = [];

const recipe = {
  title: '감자 우유 수프', summary: '차감 테스트', servings: 2, cookingMinutes: 20,
  usedIngredients: [{ name: '감자', amount: '2개' }, { name: '우유', amount: '500ml' }, { name: '소금', amount: '약간' }, { name: '간장', amount: '적당량' }],
  basicSeasonings: [], missingIngredients: [], preparationSteps: [{ ingredientName: '감자', instruction: '씻는다.' }],
  cookingSteps: ['끓인다.'], safetyNotes: ['충분히 익힌다.'],
};

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test backend did not start in time.');
}

async function register(label) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const response = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: `${label}${suffix}`, password: 'recipe-consumption-test!', nickname: `${label}${suffix}`.slice(0, 20) }) });
  const body = await response.text(); assert.equal(response.status, 201, body);
  const session = JSON.parse(body); userIds.push(session.user.id);
  return { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };
}

async function createItem(headers, name, quantity, unit) {
  const response = await fetch(`${baseUrl}/expiration-items`, { method: 'POST', headers, body: JSON.stringify({ name, quantity, unit, purchasedAt: '2026-08-24', expirationDate: '2026-12-31' }) });
  const body = await response.text(); assert.equal(response.status, 201, body); return JSON.parse(body);
}

async function main() {
  await database.connect();
  server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await waitForServer();
  const headers = await register('cook');
  const otherHeaders = await register('other');
  const potato = await createItem(headers, '감자', '2', 'COUNT');
  const milk = await createItem(headers, '우유', '1', 'L');
  const salt = await createItem(headers, '소금', '100', 'G');
  const soySauce = await createItem(headers, '간장', '1', 'BOTTLE');

  const previewResponse = await fetch(`${baseUrl}/recipe-consumptions/preview`, { method: 'POST', headers, body: JSON.stringify(recipe) });
  const previewBody = await previewResponse.text(); assert.equal(previewResponse.status, 200, previewBody);
  const preview = JSON.parse(previewBody);
  assert.equal(preview.lines[0].suggestedQuantity, '2');
  assert.equal(preview.lines[1].suggestedQuantity, '0.5');
  assert.equal(preview.lines[2].status, 'UNSUPPORTED');
  assert.equal(preview.lines[2].manualItems[0].itemId, salt.id);
  assert.equal(preview.lines[2].manualItems[0].currentQuantity, '100');
  assert.equal(preview.lines[3].manualItems[0].unit, 'BOTTLE');

  const key = `consume-${Date.now()}`;
  const consumeInput = { recipeTitle: recipe.title, idempotencyKey: key, deductions: [{ itemId: potato.id, quantity: '2' }, { itemId: milk.id, quantity: '0.5' }, { itemId: salt.id, quantity: '10' }, { itemId: soySauce.id, remainingQuantity: '700', unit: 'ML' }] };
  const consumeResponse = await fetch(`${baseUrl}/recipe-consumptions`, { method: 'POST', headers, body: JSON.stringify(consumeInput) });
  const consumeBody = await consumeResponse.text(); assert.equal(consumeResponse.status, 201, consumeBody);
  const result = JSON.parse(consumeBody); assert.equal(result.updatedItems.length, 4); assert.ok(result.updatedItems.find(({ id }) => id === potato.id).removed);

  const after = await (await fetch(`${baseUrl}/expiration-items`, { headers })).json();
  assert.equal(after.some(({ id }) => id === potato.id), false);
  assert.equal(after.find(({ id }) => id === milk.id).quantity, '0.5');
  assert.equal(after.find(({ id }) => id === salt.id).quantity, '90');
  assert.equal(after.find(({ id }) => id === soySauce.id).quantity, '700');
  assert.equal(after.find(({ id }) => id === soySauce.id).unit, 'ML');

  const duplicateResponse = await fetch(`${baseUrl}/recipe-consumptions`, { method: 'POST', headers, body: JSON.stringify(consumeInput) });
  assert.equal(duplicateResponse.status, 201);
  const afterDuplicate = await (await fetch(`${baseUrl}/expiration-items`, { headers })).json();
  assert.equal(afterDuplicate.find(({ id }) => id === milk.id).quantity, '0.5');

  const foreignResponse = await fetch(`${baseUrl}/recipe-consumptions`, { method: 'POST', headers: otherHeaders, body: JSON.stringify({ recipeTitle: recipe.title, idempotencyKey: `foreign-${Date.now()}`, deductions: [{ itemId: milk.id, quantity: '0.1' }] }) });
  assert.equal(foreignResponse.status, 400);
  console.log('Recipe consumption preview, deduction, removal, ownership, and idempotency test passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) server.kill();
  if (userIds.length) await database.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  await database.end();
});

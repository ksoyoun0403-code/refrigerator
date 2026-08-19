const assert = require('node:assert/strict');
const test = require('node:test');
const {
  extractExpirationDateCandidates,
} = require('../dist/expiration-scans/expiration-date-parser.js');

test('지원 날짜 형식을 YYYY-MM-DD로 정규화한다', () => {
  const candidates = extractExpirationDateCandidates(
    '2026.08.25 2026-9-2 2026/10/03 20261104 2026년 12월 5일',
    87,
  );

  assert.deepEqual(
    candidates.map(({ expirationDate }) => expirationDate),
    ['2026-08-25', '2026-09-02', '2026-10-03', '2026-11-04', '2026-12-05'],
  );
});

test('두 자리 연도는 확인이 필요한 20YY 후보로 반환한다', () => {
  const [candidate] = extractExpirationDateCandidates('소비기한 26.08.25', 75);

  assert.equal(candidate.expirationDate, '2026-08-25');
  assert.equal(candidate.requiresConfirmation, true);
});

test('유효하지 않은 날짜와 날짜가 없는 문장은 제외한다', () => {
  assert.deepEqual(extractExpirationDateCandidates('2026.02.30', 90), []);
  assert.deepEqual(extractExpirationDateCandidates('날짜 표시 없음', 90), []);
});

test('같은 날짜 후보는 중복을 제거하고 네 자리 연도를 우선한다', () => {
  const candidates = extractExpirationDateCandidates('26.08.25 / 2026-08-25', 92);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].requiresConfirmation, false);
});

test('OCR 신뢰도를 0부터 1 사이로 변환한다', () => {
  assert.equal(
    extractExpirationDateCandidates('2026-08-25', 87)[0].confidence,
    0.87,
  );
  assert.equal(
    extractExpirationDateCandidates('2026-08-25', 120)[0].confidence,
    1,
  );
});

test('공백이 섞인 OCR 날짜를 인식한다', () => {
  const [candidate] = extractExpirationDateCandidates(
    '2026 12.0174612',
    70,
  );

  assert.equal(candidate.expirationDate, '2026-12-01');
});

test('유통기한, 소비기한, 까지 문맥의 날짜를 먼저 반환한다', () => {
  const candidates = extractExpirationDateCandidates(
    '제조일 2026.01.01 유통기한: 2026.12.01까지',
    90,
  );

  assert.equal(candidates[0].expirationDate, '2026-12-01');
});

test('OCR이 구분자를 놓치고 YYYY MMDD로 읽은 날짜를 인식한다', () => {
  const [candidate] = extractExpirationDateCandidates('2027 0311', 73);

  assert.equal(candidate.expirationDate, '2027-03-11');
  assert.equal(candidate.requiresConfirmation, false);
});

test('날짜 뒤의 시간과 다음 줄 숫자를 별도 날짜로 오인하지 않는다', () => {
  const candidates = extractExpirationDateCandidates(
    '2026.08.05/20:39\n2027.08.04/F3\n39\n.\n08.04',
    70,
  );

  assert.deepEqual(
    candidates.map(({ expirationDate }) => expirationDate),
    ['2026-08-05', '2027-08-04'],
  );
});

test('OCR이 날짜 뒤에 LOT 문자를 붙인 경우 확인 후보로 복구한다', () => {
  const [candidate] = extractExpirationDateCandidates('2026.12.01742', 61);

  assert.equal(candidate.expirationDate, '2026-12-01');
  assert.equal(candidate.requiresConfirmation, true);
});

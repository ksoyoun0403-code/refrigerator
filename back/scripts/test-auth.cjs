const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeUniqueKey,
  validateLoginRequest,
  validateChangePasswordRequest,
  validateRefreshRequest,
  validateRegisterRequest,
  validateUpdateNicknameRequest,
} = require('../dist/auth/auth-validation.js');
const { PasswordHasher } = require('../dist/auth/password-hasher.js');

test('회원가입 입력을 정규화한다', () => {
  assert.deepEqual(
    validateRegisterRequest({
      loginId: 'Test.User',
      password: 'password123!',
      nickname: '  냉장고요리사  ',
    }),
    {
      loginId: 'Test.User',
      loginIdKey: 'test.user',
      password: 'password123!',
      nickname: '냉장고요리사',
      nicknameKey: '냉장고요리사',
    },
  );
});

test('대소문자와 호환 유니코드를 중복 비교용 키로 정규화한다', () => {
  assert.equal(normalizeUniqueKey('ＴＥＳＴ'), 'test');
  assert.equal(normalizeUniqueKey('NickName'), 'nickname');
});

test('잘못된 아이디, 비밀번호와 닉네임을 거부한다', () => {
  assert.throws(
    () => validateRegisterRequest({ loginId: '한글', password: 'password123', nickname: '닉네임' }),
    /아이디는/,
  );
  assert.throws(
    () => validateRegisterRequest({ loginId: 'testuser', password: 'short', nickname: '닉네임' }),
    /비밀번호는/,
  );
  assert.throws(
    () => validateRegisterRequest({ loginId: 'testuser', password: 'password123', nickname: '닉' }),
    /닉네임은/,
  );
});

test('로그인 입력은 존재 여부를 노출하지 않는 공통 형식으로 검사한다', () => {
  assert.deepEqual(
    validateLoginRequest({ loginId: 'Test_User', password: 'password123' }),
    { loginIdKey: 'test_user', password: 'password123' },
  );
});

test('refresh token 형식을 검사한다', () => {
  const token = 'a'.repeat(64);
  assert.deepEqual(validateRefreshRequest({ refreshToken: token }), { refreshToken: token });
  assert.throws(() => validateRefreshRequest({ refreshToken: 'short' }), /refreshToken/);
});

test('비밀번호 변경 입력과 재사용을 검사한다', () => {
  assert.deepEqual(
    validateChangePasswordRequest({
      currentPassword: 'password123!',
      newPassword: 'new-password456!',
    }),
    { currentPassword: 'password123!', newPassword: 'new-password456!' },
  );
  assert.throws(
    () => validateChangePasswordRequest({ currentPassword: 'same-password!', newPassword: 'same-password!' }),
    /달라야/,
  );
});

test('닉네임 변경 입력을 회원가입과 같은 기준으로 정규화한다', () => {
  assert.deepEqual(validateUpdateNicknameRequest({ nickname: '  새닉네임  ' }), {
    nickname: '새닉네임', nicknameKey: '새닉네임',
  });
  assert.throws(() => validateUpdateNicknameRequest({ nickname: '닉' }), /닉네임은/);
});

test('scrypt로 비밀번호를 솔트 해시하고 상수 시간으로 검증한다', async () => {
  const hasher = new PasswordHasher();
  const first = await hasher.hash('password123!');
  const second = await hasher.hash('password123!');

  assert.match(first, /^scrypt\$/);
  assert.notEqual(first, second);
  assert.equal(await hasher.verify('password123!', first), true);
  assert.equal(await hasher.verify('wrong-password', first), false);
  assert.equal(await hasher.verify('password123!', 'invalid'), false);
});

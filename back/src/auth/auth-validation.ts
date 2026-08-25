import { BadRequestException } from '@nestjs/common';
import { ChangePasswordRequest, LoginRequest, RefreshRequest, RegisterRequest, UpdateNicknameRequest } from './auth.types';

const LOGIN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{3,29}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function normalizeUniqueKey(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR');
}

export function validateRegisterRequest(input: unknown) {
  const record = asRecord(input);
  const loginId = stringField(record as RegisterRequest, 'loginId').normalize('NFKC');
  const password = stringField(record as RegisterRequest, 'password');
  const nickname = stringField(record as RegisterRequest, 'nickname').normalize('NFKC').trim();

  validateLoginId(loginId);
  validatePassword(password);
  validateNickname(nickname);

  return {
    loginId,
    loginIdKey: normalizeUniqueKey(loginId),
    password,
    nickname,
    nicknameKey: normalizeUniqueKey(nickname),
  };
}

export function validateLoginRequest(input: unknown) {
  const record = asRecord(input);
  const loginId = stringField(record as LoginRequest, 'loginId').normalize('NFKC');
  const password = stringField(record as LoginRequest, 'password');
  validateLoginId(loginId);
  if (!password || password.length > 128) {
    throw new BadRequestException('아이디 또는 비밀번호 형식을 확인해주세요.');
  }
  return { loginIdKey: normalizeUniqueKey(loginId), password };
}

export function validateRefreshRequest(input: unknown) {
  const record = asRecord(input);
  const refreshToken = stringField(record as RefreshRequest, 'refreshToken');
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(refreshToken)) {
    throw new BadRequestException('유효한 refreshToken이 필요합니다.');
  }
  return { refreshToken };
}

export function validateChangePasswordRequest(input: unknown) {
  const record = asRecord(input);
  const currentPassword = stringField(record as ChangePasswordRequest, 'currentPassword');
  const newPassword = stringField(record as ChangePasswordRequest, 'newPassword');
  if (!currentPassword || currentPassword.length > 128) {
    throw new BadRequestException('현재 비밀번호를 확인해주세요.');
  }
  validatePassword(newPassword);
  if (currentPassword === newPassword) {
    throw new BadRequestException('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
  }
  return { currentPassword, newPassword };
}

export function validateUpdateNicknameRequest(input: unknown) {
  const record = asRecord(input);
  const nickname = stringField(record as UpdateNicknameRequest, 'nickname').normalize('NFKC').trim();
  validateNickname(nickname);
  return { nickname, nicknameKey: normalizeUniqueKey(nickname) };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('요청 정보를 확인해주세요.');
  }
  return input as Record<string, unknown>;
}

function stringField(input: object, field: string) {
  const value = (input as Record<string, unknown>)[field];
  if (typeof value !== 'string') {
    throw new BadRequestException('요청 정보를 확인해주세요.');
  }
  return value;
}

function validateLoginId(loginId: string) {
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new BadRequestException(
      '아이디는 영문 또는 숫자로 시작하고 영문, 숫자, 점, 밑줄, 하이픈을 사용해 4~30자로 입력해주세요.',
    );
  }
}

function validatePassword(password: string) {
  if (
    password.length < 8 ||
    password.length > 128 ||
    CONTROL_CHARACTER_PATTERN.test(password)
  ) {
    throw new BadRequestException('비밀번호는 제어 문자를 제외한 8~128자로 입력해주세요.');
  }
}

function validateNickname(nickname: string) {
  if (
    nickname.length < 2 ||
    nickname.length > 20 ||
    CONTROL_CHARACTER_PATTERN.test(nickname)
  ) {
    throw new BadRequestException('닉네임은 제어 문자를 제외한 2~20자로 입력해주세요.');
  }
}

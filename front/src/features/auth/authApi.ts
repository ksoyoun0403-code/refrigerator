import { AuthSession, AuthUser, LoginInput, RegisterInput } from './types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/v1';

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export function register(input: RegisterInput) {
  return request<AuthSession>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function login(input: LoginInput) {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function refresh(refreshToken: string) {
  return request<AuthSession>('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(refreshToken: string) {
  return request<void>('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

export function getMe(accessToken: string) {
  return request<AuthUser>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function changePassword(
  accessToken: string,
  input: { currentPassword: string; newPassword: string },
) {
  return request<void>('/auth/password', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export function updateNickname(accessToken: string, nickname: string) {
  return request<AuthUser>('/users/me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nickname }),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new AuthApiError(
      `백엔드에 연결할 수 없습니다. API 주소(${API_BASE_URL})와 서버 상태를 확인해주세요.`,
    );
  }

  if (!response.ok) {
    let message = `인증 요청에 실패했습니다. (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message)
        ? body.message.join('\n')
        : body.message || message;
    } catch {
      // Keep the status fallback for an empty or non-JSON response.
    }
    throw new AuthApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

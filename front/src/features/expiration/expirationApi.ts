import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import {
  CreateExpirationItem,
  ExpirationItem,
  ExpirationScanResult,
  LocalImage,
  UpdateExpirationItem,
} from './types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(
      `백엔드에 연결할 수 없습니다. API 주소(${API_BASE_URL})와 서버 실행 상태를 확인해주세요.`,
    );
  }

  if (!response.ok) {
    let message = `API 요청 실패 (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join('\n');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Keep the HTTP status fallback when the response has no JSON body.
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function getExpirationItems() {
  return request<ExpirationItem[]>('/expiration-items');
}

export function createExpirationItem(input: CreateExpirationItem) {
  return request<ExpirationItem>('/expiration-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteExpirationItem(id: string) {
  return request<void>(`/expiration-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function updateExpirationItem(id: string, input: UpdateExpirationItem) {
  return request<ExpirationItem>(
    `/expiration-items/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function scanExpirationImage(image: LocalImage) {
  const form = new FormData();
  form.append('image', new File(image.uri), image.fileName);

  return request<ExpirationScanResult>('/expiration-scans', {
    method: 'POST',
    body: form,
  });
}

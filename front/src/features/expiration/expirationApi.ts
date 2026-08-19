import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import {
  ExpirationItem,
  ExpirationScanResult,
  LocalImage,
} from './types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(
      `Backend에 연결할 수 없습니다. API 주소(${API_BASE_URL})와 서버 실행 상태를 확인해 주세요.`,
    );
  }

  if (!response.ok) {
    throw new Error(`API 요청 실패 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getExpirationItems() {
  return request<ExpirationItem[]>('/expiration-items');
}

export function createExpirationItem(
  input: Pick<ExpirationItem, 'name' | 'expirationDate' | 'source'>,
) {
  return request<ExpirationItem>('/expiration-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function scanExpirationImage(image: LocalImage) {
  const form = new FormData();
  form.append('image', new File(image.uri), image.fileName);

  return request<ExpirationScanResult>('/expiration-scans', {
    method: 'POST',
    body: form,
  });
}

import {
  ExpirationItem,
  ExpirationScanResult,
  LocalImage,
} from './types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
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
  form.append(
    'image',
    {
      uri: image.uri,
      name: image.fileName,
      type: image.mimeType,
    } as unknown as Blob,
  );

  return request<ExpirationScanResult>('/expiration-scans', {
    method: 'POST',
    body: form,
  });
}

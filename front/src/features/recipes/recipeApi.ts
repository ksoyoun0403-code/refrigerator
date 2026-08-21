import { fetch } from 'expo/fetch';
import {
  GenerateRecipeSuggestions,
  RecipeSuggestionResult,
} from './types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/v1';

export async function generateRecipeSuggestions(
  input: GenerateRecipeSuggestions,
) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/recipe-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Backend에 연결하지 못했어요. 서버 실행 상태를 확인해주세요.');
  }

  if (!response.ok) {
    let message = `레시피 요청에 실패했어요. (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message)
        ? body.message.join('\n')
        : body.message || message;
    } catch {
      // Keep the status fallback when the error response has no JSON body.
    }
    throw new Error(message);
  }

  return response.json() as Promise<RecipeSuggestionResult>;
}

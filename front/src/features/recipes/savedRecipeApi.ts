import { fetch } from 'expo/fetch';
import { RecipeSuggestion, SavedRecipe } from './types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/v1';

export async function getSavedRecipes() {
  return request<SavedRecipe[]>(`${API_BASE_URL}/saved-recipes`);
}

export async function saveRecipe(recipe: RecipeSuggestion) {
  return request<SavedRecipe>(`${API_BASE_URL}/saved-recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });
}

export async function deleteSavedRecipe(id: string) {
  await request<void>(`${API_BASE_URL}/saved-recipes/${id}`, {
    method: 'DELETE',
  });
}

export function recipeIdentity(recipe: RecipeSuggestion) {
  return JSON.stringify(recipe);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('Backend에 연결하지 못했어요. 서버 실행 상태를 확인해주세요.');
  }

  if (!response.ok) {
    let message = `저장 레시피 요청에 실패했어요. (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message)
        ? body.message.join('\n')
        : body.message || message;
    } catch {
      // Keep the HTTP status fallback for responses without a JSON body.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

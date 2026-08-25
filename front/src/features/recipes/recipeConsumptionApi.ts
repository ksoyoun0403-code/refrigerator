import { authenticatedFetch } from '../auth/authenticatedFetch';
import { RecipeConsumptionPreview, RecipeConsumptionResult, RecipeSuggestion } from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/v1';

export function previewRecipeConsumption(recipe: RecipeSuggestion) {
  return request<RecipeConsumptionPreview>(`${API_BASE_URL}/recipe-consumptions/preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipe),
  });
}

export function checkRecipeAvailability(recipe: RecipeSuggestion) {
  return previewRecipeConsumption({
    ...recipe,
    usedIngredients: [...recipe.usedIngredients, ...recipe.missingIngredients],
    missingIngredients: [],
  });
}

export function consumeRecipeIngredients(recipeTitle: string, idempotencyKey: string, deductions: Array<{ itemId: string; quantity: string } | { itemId: string; remainingQuantity: string; unit: string }>) {
  return request<RecipeConsumptionResult>(`${API_BASE_URL}/recipe-consumptions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeTitle, idempotencyKey, deductions }),
  });
}

async function request<T>(url: string, init: RequestInit) {
  let response: Response;
  try { response = await authenticatedFetch(url, init); }
  catch { throw new Error('서버에 연결하지 못했습니다. 실행 상태를 확인해주세요.'); }
  if (!response.ok) {
    let message = `재료 차감 요청에 실패했습니다. (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join('\n') : body.message || message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

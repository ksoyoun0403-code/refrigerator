import { authenticatedFetch } from '../auth/authenticatedFetch';
import { RecipeComment, RecipeCommentPage, RecipePost, RecipePostListItem, RecipeSuggestion } from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/v1';

export function getRecipePosts(query = '') {
  const search = query.trim();
  const suffix = search ? `?q=${encodeURIComponent(search)}` : '';
  return request<RecipePostListItem[]>(`${API_BASE_URL}/recipe-posts${suffix}`);
}

export function getRecipePost(id: string) {
  return request<RecipePost>(`${API_BASE_URL}/recipe-posts/${encodeURIComponent(id)}`);
}

export function shareRecipePost(recipe: RecipeSuggestion) {
  return request<RecipePost>(`${API_BASE_URL}/recipe-posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });
}

export function getMyRecipePosts(query = '') {
  const suffix = searchSuffix(query);
  return request<RecipePostListItem[]>(`${API_BASE_URL}/recipe-posts/mine${suffix}`);
}

export function getBookmarkedRecipePosts(query = '') {
  const suffix = searchSuffix(query);
  return request<RecipePostListItem[]>(`${API_BASE_URL}/recipe-posts/bookmarked${suffix}`);
}

function searchSuffix(query: string) {
  const search = query.trim();
  return search ? `?q=${encodeURIComponent(search)}` : '';
}

export function bookmarkRecipePost(id: string) {
  return request<RecipePost>(`${API_BASE_URL}/recipe-posts/${encodeURIComponent(id)}/bookmark`, { method: 'POST' });
}

export function removeRecipePostBookmark(id: string) {
  return request<void>(`${API_BASE_URL}/recipe-posts/${encodeURIComponent(id)}/bookmark`, { method: 'DELETE' });
}

export function deleteRecipePost(id: string) {
  return request<void>(`${API_BASE_URL}/recipe-posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getRecipeComments(recipePostId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  return request<RecipeCommentPage>(`${API_BASE_URL}/recipe-posts/${encodeURIComponent(recipePostId)}/comments?${query}`);
}

export function createRecipeComment(recipePostId: string, content: string) {
  return request<RecipeComment>(`${API_BASE_URL}/recipe-posts/${encodeURIComponent(recipePostId)}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
  });
}

export function updateRecipeComment(id: string, content: string) {
  return request<RecipeComment>(`${API_BASE_URL}/recipe-comments/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
  });
}

export function deleteRecipeComment(id: string) {
  return request<void>(`${API_BASE_URL}/recipe-comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(url, init);
  } catch {
    throw new Error('서버에 연결하지 못했습니다. 실행 상태를 확인해주세요.');
  }
  if (!response.ok) {
    let message = `공유 레시피 요청에 실패했습니다. (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join('\n') : body.message || message;
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

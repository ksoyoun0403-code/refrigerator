import { fetch } from 'expo/fetch';
import { refresh } from './authApi';
import { AuthSession } from './types';

let currentSession: AuthSession | undefined;
let sessionUpdated: ((session: AuthSession) => Promise<void>) | undefined;
let sessionExpired: (() => Promise<void>) | undefined;
let refreshInFlight: Promise<AuthSession> | undefined;

export function configureAuthenticatedFetch(
  session: AuthSession | undefined,
  callbacks?: {
    onSessionUpdated(session: AuthSession): Promise<void>;
    onSessionExpired(): Promise<void>;
  },
) {
  currentSession = session;
  if (callbacks) {
    sessionUpdated = callbacks.onSessionUpdated;
    sessionExpired = callbacks.onSessionExpired;
  }
  if (!session) refreshInFlight = undefined;
}

export async function authenticatedFetch(url: string, init?: RequestInit) {
  if (!currentSession) throw new Error('로그인이 필요합니다.');

  let response = await fetchWithAccessToken(url, init, currentSession.accessToken);
  if (response.status !== 401) return response;

  try {
    refreshInFlight ??= refresh(currentSession.refreshToken).finally(() => {
      refreshInFlight = undefined;
    });
    const nextSession = await refreshInFlight;
    currentSession = nextSession;
    await sessionUpdated?.(nextSession);
    response = await fetchWithAccessToken(url, init, nextSession.accessToken);
    return response;
  } catch (error) {
    currentSession = undefined;
    await sessionExpired?.();
    throw error;
  }
}

function fetchWithAccessToken(url: string, init: RequestInit | undefined, accessToken: string) {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers });
}

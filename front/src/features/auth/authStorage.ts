import * as SecureStore from 'expo-secure-store';
import { AuthSession } from './types';

const SESSION_KEY = 'mydish.auth-session.v1';
const SAVED_LOGIN_ID_KEY = 'mydish.saved-login-id.v1';

export async function loadStoredSession(): Promise<AuthSession | undefined> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return undefined;

  try {
    const session = JSON.parse(value) as Partial<AuthSession>;
    if (
      !session.user ||
      typeof session.user.id !== 'string' ||
      typeof session.user.loginId !== 'string' ||
      typeof session.user.nickname !== 'string' ||
      typeof session.accessToken !== 'string' ||
      typeof session.refreshToken !== 'string'
    ) {
      throw new Error('Invalid stored session');
    }
    return session as AuthSession;
  } catch {
    await clearStoredSession();
    return undefined;
  }
}

export function saveStoredSession(session: AuthSession) {
  return SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  return SecureStore.deleteItemAsync(SESSION_KEY);
}

export function loadSavedLoginId() {
  return SecureStore.getItemAsync(SAVED_LOGIN_ID_KEY);
}

export function saveLoginId(loginId: string) {
  return SecureStore.setItemAsync(SAVED_LOGIN_ID_KEY, loginId);
}

export function clearSavedLoginId() {
  return SecureStore.deleteItemAsync(SAVED_LOGIN_ID_KEY);
}

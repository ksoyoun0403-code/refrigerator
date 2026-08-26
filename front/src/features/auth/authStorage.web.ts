import { AuthSession } from './types';

const SESSION_KEY = 'mydish.auth-session.v1';
const SAVED_LOGIN_ID_KEY = 'mydish.saved-login-id.v1';

export async function loadStoredSession(): Promise<AuthSession | undefined> {
  const value = window.sessionStorage.getItem(SESSION_KEY);
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

export async function saveStoredSession(session: AuthSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function loadSavedLoginId() {
  return window.localStorage.getItem(SAVED_LOGIN_ID_KEY) ?? undefined;
}

export async function saveLoginId(loginId: string) {
  window.localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId);
}

export async function clearSavedLoginId() {
  window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
}

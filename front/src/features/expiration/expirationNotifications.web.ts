import { ExpirationItem } from './types';

const SETTINGS_KEY_PREFIX = 'mydish.expiration-notification-settings.';
const PERMISSION_ONBOARDING_KEY = 'mydish.expiration-notification-permission-onboarding.v1';

export type ExpirationReminderDay = 0 | 1 | 2;

export type ExpirationNotificationSettings = {
  enabled: boolean;
  daysBefore: ExpirationReminderDay[];
  hour: number;
  minute: number;
};

export type ExpirationNotificationStatus = 'enabled' | 'denied' | 'error';

export const DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS: ExpirationNotificationSettings = {
  enabled: false,
  daysBefore: [2],
  hour: 9,
  minute: 0,
};

export async function hasShownExpirationNotificationPermissionOnboarding() {
  return window.localStorage.getItem(PERMISSION_ONBOARDING_KEY) === 'shown';
}

export async function markExpirationNotificationPermissionOnboardingShown() {
  window.localStorage.setItem(PERMISSION_ONBOARDING_KEY, 'shown');
}

export async function requestExpirationNotificationAccess(): Promise<ExpirationNotificationStatus> {
  return 'error';
}

export async function syncExpirationNotifications(
  _userId: string,
  _items: ExpirationItem[],
  _providedSettings?: ExpirationNotificationSettings,
): Promise<ExpirationNotificationStatus> {
  return 'error';
}

export async function loadExpirationNotificationSettings(userId: string) {
  const stored = window.localStorage.getItem(`${SETTINGS_KEY_PREFIX}${userId}`);
  if (!stored) return DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS;
  try {
    return JSON.parse(stored) as ExpirationNotificationSettings;
  } catch {
    return DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS;
  }
}

export async function saveExpirationNotificationSettings(
  userId: string,
  settings: ExpirationNotificationSettings,
) {
  window.localStorage.setItem(`${SETTINGS_KEY_PREFIX}${userId}`, JSON.stringify(settings));
}

export async function clearExpirationNotifications(_userId: string) {
  // Browser notification scheduling is outside the first web MVP scope.
}

export function getExpirationReminderDate(
  expirationDate: string | null,
  now: Date,
  settings = DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS,
  daysBefore: ExpirationReminderDay = settings.daysBefore[0] ?? 2,
) {
  if (!expirationDate) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expirationDate);
  if (!match) return undefined;

  const expiration = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (expiration < today) return undefined;

  const reminder = new Date(expiration);
  reminder.setDate(reminder.getDate() - daysBefore);
  reminder.setHours(settings.hour, settings.minute, 0, 0);
  return reminder > now ? reminder : undefined;
}

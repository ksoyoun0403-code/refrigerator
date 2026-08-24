import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ExpirationItem } from './types';

const CHANNEL_ID = 'expiration-reminders';
const NOTIFICATION_TYPE = 'mydish.expiration-reminder';
const SETTINGS_KEY_PREFIX = 'mydish.expiration-notification-settings.';
const HISTORY_KEY_PREFIX = 'mydish.expiration-notification-history.';
const MAX_HISTORY_SIZE = 1000;

export type ExpirationReminderDay = 0 | 1 | 2;

export type ExpirationNotificationSettings = {
  enabled: boolean;
  daysBefore: ExpirationReminderDay[];
  hour: number;
  minute: number;
};

export const DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS: ExpirationNotificationSettings = {
  enabled: true,
  daysBefore: [2],
  hour: 9,
  minute: 0,
};

export type ExpirationNotificationStatus = 'enabled' | 'denied' | 'error';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function syncExpirationNotifications(
  userId: string,
  items: ExpirationItem[],
  providedSettings?: ExpirationNotificationSettings,
): Promise<ExpirationNotificationStatus> {
  try {
    const settings = providedSettings ?? await loadExpirationNotificationSettings(userId);
    if (!settings.enabled) {
      await clearExpirationNotifications(userId);
      return 'enabled';
    }
    const permitted = await prepareNotifications();
    if (!permitted) return 'denied';

    const now = new Date();
    const schedulable = items
      .flatMap((item) => settings.daysBefore.map((daysBefore) => ({
        item,
        date: getExpirationReminderDate(item.expirationDate, now, settings, daysBefore),
        reminderKey: getReminderKey(item, settings, daysBefore),
      })))
      .filter((entry): entry is ReminderEntry => Boolean(entry.date && entry.reminderKey));

    const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter(({ content }) =>
      content.data?.type === NOTIFICATION_TYPE && content.data.userId === userId,
    );
    const activeKeys = new Set(scheduled.flatMap(({ content }) => readReminderKeys(content.data)));
    const history = await loadReminderHistory(userId);
    const completedKeys = new Set([...history].filter((key) => !activeKeys.has(key)));
    const groups = new Map<number, ReminderEntry[]>();
    for (const entry of schedulable) {
      if (completedKeys.has(entry.reminderKey)) continue;
      const { date } = entry;
      const key = date.getTime();
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }

    const desiredSignatures = new Set([...groups.values()].map((entries) => signature(entries.map(({ reminderKey }) => reminderKey))));
    const keptSignatures = new Set<string>();
    for (const request of scheduled) {
      const keys = readReminderKeys(request.content.data);
      const requestSignature = signature(keys);
      if (keys.length > 0 && desiredSignatures.has(requestSignature) && !keptSignatures.has(requestSignature)) {
        keptSignatures.add(requestSignature);
        continue;
      }
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
      keys.forEach((key) => history.delete(key));
    }

    for (const [timestamp, entries] of groups) {
      const keys = entries.map(({ reminderKey }) => reminderKey);
      if (keptSignatures.has(signature(keys))) continue;
      const groupedItems = entries.map(({ item }) => item);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '유통기한이 얼마 남지 않았어요',
          body: groupedItems.length === 1
            ? `${groupedItems[0].name}의 유통기한은 ${formatExpirationDate(groupedItems[0].expirationDate!)}입니다.`
            : `${groupedItems[0].name} 외 ${groupedItems.length - 1}개 식품의 유통기한이 임박했어요.`,
          data: {
            type: NOTIFICATION_TYPE,
            userId,
            itemId: groupedItems.length === 1 ? groupedItems[0].id : undefined,
            reminderKeys: keys,
          },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(timestamp),
          channelId: CHANNEL_ID,
        },
      });
      keys.forEach((key) => history.add(key));
    }
    await saveReminderHistory(userId, history);
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function loadExpirationNotificationSettings(userId: string) {
  try {
    const stored = await SecureStore.getItemAsync(`${SETTINGS_KEY_PREFIX}${userId}`);
    if (!stored) return DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const hour = Number.isInteger(parsed.hour) && Number(parsed.hour) >= 0 && Number(parsed.hour) <= 23 ? Number(parsed.hour) : 9;
    const minute = Number.isInteger(parsed.minute) && Number(parsed.minute) >= 0 && Number(parsed.minute) <= 59 ? Number(parsed.minute) : 0;
    return {
      enabled: parsed.enabled !== false,
      daysBefore: normalizeReminderDays(parsed.daysBefore),
      hour,
      minute,
    } satisfies ExpirationNotificationSettings;
  } catch {
    return DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS;
  }
}

export async function saveExpirationNotificationSettings(
  userId: string,
  settings: ExpirationNotificationSettings,
) {
  await SecureStore.setItemAsync(`${SETTINGS_KEY_PREFIX}${userId}`, JSON.stringify(settings));
}

export async function clearExpirationNotifications(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const owned = scheduled.filter(({ content }) =>
    content.data?.type === NOTIFICATION_TYPE && content.data.userId === userId,
  );
  const history = await loadReminderHistory(userId);
  await Promise.all(owned.map(async ({ content, identifier }) => {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    readReminderKeys(content.data).forEach((key) => history.delete(key));
  }));
  await saveReminderHistory(userId, history);
}

export function getExpirationReminderDate(
  expirationDate: string | null,
  now: Date,
  settings = DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS,
  daysBefore: ExpirationReminderDay = settings.daysBefore[0] ?? 2,
) {
  const expiration = parseLocalDate(expirationDate);
  if (!expiration) return undefined;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (expiration < today) return undefined;

  const reminder = new Date(expiration);
  reminder.setDate(reminder.getDate() - daysBefore);
  reminder.setHours(settings.hour, settings.minute, 0, 0);
  if (reminder > now) return reminder;

  // 설정한 알림 시각이 이미 지난 식품은 임의의 시각으로 옮겨 알리지 않습니다.
  return undefined;
}

async function prepareNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '유통기한 알림',
      description: '냉장고 식품의 유통기한이 임박하면 알려줍니다.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F97316',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  return permission.granted;
}

function parseLocalDate(value: string | null) {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return undefined;
  return date;
}

function formatExpirationDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

type ReminderEntry = {
  item: ExpirationItem;
  date: Date;
  reminderKey: string;
};

function getReminderKey(item: ExpirationItem, settings: ExpirationNotificationSettings, daysBefore: ExpirationReminderDay) {
  if (!item.expirationDate) return undefined;
  return `${item.id}|${item.expirationDate}|${daysBefore}|${settings.hour}|${settings.minute}`;
}

function normalizeReminderDays(value: unknown): ExpirationReminderDay[] {
  const values = Array.isArray(value) ? value : [value];
  const normalized = values.filter((day): day is ExpirationReminderDay => day === 0 || day === 1 || day === 2);
  return normalized.length > 0 ? [...new Set(normalized)].sort((left, right) => right - left) : [2];
}

function readReminderKeys(data: Record<string, unknown> | undefined) {
  const value = data?.reminderKeys;
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
}

function signature(keys: string[]) {
  return [...keys].sort().join('\n');
}

async function loadReminderHistory(userId: string) {
  try {
    const stored = await SecureStore.getItemAsync(`${HISTORY_KEY_PREFIX}${userId}`);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

async function saveReminderHistory(userId: string, history: Set<string>) {
  const values = [...history].slice(-MAX_HISTORY_SIZE);
  await SecureStore.setItemAsync(`${HISTORY_KEY_PREFIX}${userId}`, JSON.stringify(values));
}

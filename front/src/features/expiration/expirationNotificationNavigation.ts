import * as Notifications from 'expo-notifications';

type ExpirationNotificationData = {
  itemId?: string;
  type?: string;
  userId?: string;
};

export function subscribeToExpirationNotificationResponses(
  onOpen: (data: ExpirationNotificationData) => void,
) {
  const openNotification = (response: Notifications.NotificationResponse | null) => {
    onOpen(response?.notification.request.content.data as ExpirationNotificationData);
  };
  void Notifications.getLastNotificationResponseAsync().then(openNotification);
  const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
  return () => subscription.remove();
}

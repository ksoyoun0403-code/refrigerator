type ExpirationNotificationData = {
  itemId?: string;
  type?: string;
  userId?: string;
};

export function subscribeToExpirationNotificationResponses(
  _onOpen: (data: ExpirationNotificationData) => void,
) {
  return () => undefined;
}

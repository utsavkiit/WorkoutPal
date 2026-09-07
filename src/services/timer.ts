import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let notificationId: string | null = null;

export async function startRestNotification(seconds: number) {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
  const permission = await Notifications.getPermissionsAsync();
  const status = permission.granted ? permission : await Notifications.requestPermissionsAsync();
  if (!status.granted) return;
  notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Rest complete', body: 'Ready for your next set.', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, seconds) },
  });
}

export async function cancelRestNotification() {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
  notificationId = null;
}

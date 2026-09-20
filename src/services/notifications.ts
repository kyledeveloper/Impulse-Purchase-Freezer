import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set notification handler
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      } as any),
    });
  } catch (e) {}
}

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (e) {
      return false;
    }
  },

  async scheduleThawNotification(itemName: string, thawTimestamp: number): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const triggerSeconds = Math.max(1, Math.floor((thawTimestamp - Date.now()) / 1000));
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '❄️ 商品冷冻期已满！',
          body: `「${itemName}」已解冻。你现在还想买它吗？点击进行抉择！`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
        },
      });
      return id;
    } catch (e) {
      console.warn('Failed to schedule notification:', e);
      return null;
    }
  },
};

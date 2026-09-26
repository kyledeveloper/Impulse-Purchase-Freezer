import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { FreezerItem } from '../types';
import { getImpulseTier, NUDGE_MESSAGES } from '../constants/intervention';

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

  /**
   * Schedules the full set of intervention nudges for a freezing item based on its tier:
   * progress milestones (25%/50%/75%), optional 1-hour-before reminder, and final thaw notice.
   * Returns all scheduled notification ids so they can be cancelled later.
   */
  async scheduleInterventionNudges(item: FreezerItem): Promise<string[]> {
    if (Platform.OS === 'web') return [];
    const ids: string[] = [];
    try {
      const tierCfg = getImpulseTier(item.price);
      const totalMs = item.thawAt - item.frozenAt;
      const now = Date.now();

      const scheduleAt = async (timestamp: number, key: keyof typeof NUDGE_MESSAGES, action: string) => {
        const seconds = Math.floor((timestamp - now) / 1000);
        if (seconds < 5) return; // skip past / imminent triggers
        const msg = NUDGE_MESSAGES[key](item.name);
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: msg.title,
            body: msg.body,
            sound: true,
            data: { screen: 'detail', itemId: item.id, action },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
          },
        });
        ids.push(id);
      };

      // Progress milestone nudges
      for (const fraction of tierCfg.notifyFractions) {
        const key = String(Math.round(fraction * 100));
        if (NUDGE_MESSAGES[key]) {
          await scheduleAt(item.frozenAt + totalMs * fraction, key, `nudge_${key}`);
        }
      }

      // Glacier tier: 1-hour-before nudge
      if (tierCfg.notifyOneHourBefore) {
        await scheduleAt(item.thawAt - 3600 * 1000, '1h', 'nudge_1h');
      }

      // Final thaw notification
      await scheduleAt(item.thawAt, 'thaw', 'thaw');
    } catch (e) {
      console.warn('Failed to schedule intervention nudges:', e);
    }
    return ids;
  },

  /**
   * Cancels all scheduled notifications belonging to an item (e.g. when resolved early).
   */
  async cancelItemNotifications(notificationIds?: string[]): Promise<void> {
    if (Platform.OS === 'web' || !notificationIds?.length) return;
    for (const id of notificationIds) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (e) {
        // notification may have already fired; ignore
      }
    }
  },

  /**
   * Schedules the 30-day post-purchase usage-feedback reminder.
   * Returns the notification id for later cancellation.
   */
  async scheduleUsageFeedbackReminder(
    itemId: string,
    itemName: string,
    days = 30
  ): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📦 购后回访',
          body: `你买的「${itemName}」用得怎么样？回来看看它是真香还是吃灰`,
          sound: false,
          data: { screen: 'vault', itemId, action: 'usage_feedback' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(60, days * 24 * 3600),
        },
      });
      return id;
    } catch (e) {
      console.warn('Failed to schedule usage feedback reminder:', e);
      return null;
    }
  },
};

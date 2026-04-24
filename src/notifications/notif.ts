import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

import {getNotificationSettings} from './settings';
import {t} from '../i18n';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function requestPermissionsAsync() {
    if (Platform.OS === 'web') return false;

    const {status: existingStatus} = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const {status} = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

export async function cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}


export async function scheduleCustomReminders() {
    await cancelAllReminders();

    const settings = await getNotificationSettings();
    if (!settings.enabled) return;

    // ✅ DAILY 타입 명시
    const dailyTrigger = (hour: number) => ({
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        repeats: true,
    });

    // 기존 아침/저녁 체크인 알림
    if (settings.morning) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: t('reminders.title'),
                body: t('reminders.body'),
            },
            trigger: dailyTrigger(settings.morningHour),
        });
    }

    if (settings.evening) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: t('reminders.title'),
                body: t('reminders.body'),
            },
            trigger: dailyTrigger(settings.eveningHour),
        });
    }

    // 스마트 리마인더
    if (settings.smartReminders) {
        // 점심 후 음식 입력 리마인더 (14:00)
        await Notifications.scheduleNotificationAsync({
            content: {
                title: t('reminders.foodReminderTitle'),
                body: t('reminders.foodReminderBody'),
            },
            trigger: dailyTrigger(14),
        });

        // 저녁 후 음식 입력 리마인더 (20:00)
        await Notifications.scheduleNotificationAsync({
            content: {
                title: t('reminders.foodReminderTitle'),
                body: t('reminders.foodReminderBody'),
            },
            trigger: dailyTrigger(20),
        });

        // 취침 전 수면 체크 리마인더 (저녁 시간 -1시간)
        const bedtimeHour = settings.eveningHour > 0 ? settings.eveningHour - 1 : 22;
        await Notifications.scheduleNotificationAsync({
            content: {
                title: t('reminders.sleepReminderTitle'),
                body: t('reminders.sleepReminderBody'),
            },
            trigger: dailyTrigger(bedtimeHour),
        });
    }
}

export async function initNotifications() {
    const ok = await requestPermissionsAsync();
    if (ok) {
        await scheduleCustomReminders();
    }
}

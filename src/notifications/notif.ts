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
}

export async function initNotifications() {
    const ok = await requestPermissionsAsync();
    if (ok) {
        await scheduleCustomReminders();
    }
}

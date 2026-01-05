import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotificationSettings } from './settings';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;

    const next = await Notifications.requestPermissionsAsync();
    return next.status === 'granted';
}

export async function initNotifications() {
    // Android는 채널 설정이 필요한 경우가 많아서 기본 채널을 세팅
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }
}

export async function cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleCustomReminders() {
    await cancelAllReminders();

    const s = await getNotificationSettings();
    if (!s.enabled || s.mode === 'none') return;

    const hasMorning = s.mode === 'morning' || s.mode === 'both';
    const hasEvening = s.mode === 'evening' || s.mode === 'both';

    if (hasMorning) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '아침 체크인',
                body: '오늘 피부 기록 잊지 마세요.',
                data: { type: 'daily-reminder', slot: 'morning' },
            },
            trigger: {
                hour: s.morningHour,
                minute: s.morningMinute,
                repeats: true,
            },
        });
    }

    if (hasEvening) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '저녁 체크인',
                body: '오늘 피부/음식 기록하고 마무리해요.',
                data: { type: 'daily-reminder', slot: 'evening' },
            },
            trigger: {
                hour: s.eveningHour,
                minute: s.eveningMinute,
                repeats: true,
            },
        });
    }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationSettings } from './types';

const NOTIF_SETTINGS_KEY = 'notificationSettings';

const DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    morning: true,
    evening: true,
    morningHour: 8,
    eveningHour: 21,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
    try {
        const json = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
        if (!json) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(json);
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export async function saveNotificationSettings(settings: NotificationSettings) {
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
}

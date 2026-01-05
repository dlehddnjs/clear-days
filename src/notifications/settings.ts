import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationSettings } from './types';

const KEY = 'notificationSettings';

const DEFAULTS: NotificationSettings = {
    enabled: true,
    mode: 'both',
    morningHour: 8,
    morningMinute: 0,
    eveningHour: 21,
    eveningMinute: 0,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
    } catch {
        return DEFAULTS;
    }
}

export async function saveNotificationSettings(settings: NotificationSettings) {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

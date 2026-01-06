import {I18n} from 'i18n-js';
import {getLocales} from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {translations} from './translation';

export type SupportedLocale = 'ko' | 'en';
const STORAGE_KEY = 'locale';

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export async function initLocale() {
    // 1. 저장된 언어 우선
    const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as SupportedLocale | null;
    if (saved === 'ko' || saved === 'en') {
        i18n.locale = saved;
        return saved;
    }

    // 2. 디바이스 언어 (OS 변경 반영)
    const device = getLocales()?.[0];
    const languageCode = device?.languageCode;
    const regionCode = device?.regionCode;

    // 한국어 우선 (ko-KR, ko 등)
    if (languageCode === 'ko') {
        const initial: SupportedLocale = 'ko';
        i18n.locale = initial;
        return initial;
    }

    // 영어 기본
    const initial: SupportedLocale = 'en';
    i18n.locale = initial;
    return initial;
}


export async function setLocale(locale: SupportedLocale) {
    i18n.locale = locale;
    await AsyncStorage.setItem(STORAGE_KEY, locale);
}

export async function getSavedLocale(): Promise<SupportedLocale | null> {
    const v = (await AsyncStorage.getItem(STORAGE_KEY)) as SupportedLocale | null;
    return v;
}

// 🔍 누락 키 감지 로거 추가
const originalT = i18n.t.bind(i18n);

export function t(key: string, options?: any) {
    const result = originalT(key, options);

    // 키가 그대로 반환되면 누락된 것으로 간주 (fallback 동작)
    if (result === key) {
        console.warn(`🚨 i18n MISSING KEY: "${key}" (locale: ${i18n.locale})`);
    }

    return result;
}

// ✅ 현재 로케일 가져오기 함수 추가
export function getCurrentLocale(): SupportedLocale {
    return (i18n.locale as SupportedLocale) || 'en';
}

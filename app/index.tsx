import {useEffect, useState} from 'react';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter} from 'expo-router';

import {getSavedLocale, initLocale} from '../src/i18n';
import {initNotifications} from "../src/notifications/notif";
import {migrate} from "../src/db/schema";

SplashScreen.preventAutoHideAsync();

export default function Index() {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            await migrate();
            await initNotifications();
            // 🔄 OS 언어 변경 반영을 위해 매번 initLocale 호출
            await initLocale();

            const hasCompletedOnboarding = (await AsyncStorage.getItem('hasCompletedOnboarding')) === 'true';
            const locale = await getSavedLocale();

            if (!locale) {
                router.replace('/language');
            } else if (hasCompletedOnboarding) {
                router.replace('/(tabs)');
            } else {
                router.replace('/onboarding');
            }

            await SplashScreen.hideAsync();
            setReady(true);
        })();
    }, [router]);

    if (!ready) return null;
    return null; // replace 완료 후 사라짐
}

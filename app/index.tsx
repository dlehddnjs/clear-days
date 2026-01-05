import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrate } from '../src/db/schema';
import { initNotifications } from '../src/notifications/notif';

export default function Index() {
    const [ready, setReady] = useState(false);
    const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

    useEffect(() => {
        (async () => {
            await migrate();
            await initNotifications();

            const v = await AsyncStorage.getItem('hasCompletedOnboarding');
            setHasOnboarded(v === 'true');
            setReady(true);
        })();
    }, []);

    if (!ready || hasOnboarded === null) return null;

    if (!hasOnboarded) return <Redirect href="/onboarding" />;
    return <Redirect href="/(tabs)" />;
}

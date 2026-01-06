import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { setLocale, t } from '../src/i18n';

export default function LanguageScreen() {
    const pick = async (locale: 'ko' | 'en') => {
        await setLocale(locale);

        const hasCompletedOnboarding = (await AsyncStorage.getItem('hasCompletedOnboarding')) === 'true';
        router.replace(hasCompletedOnboarding ? '/(tabs)' : '/onboarding');
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
                {t('languagePick.title')}
            </Text>

            <Pressable onPress={() => pick('ko')} style={{ padding: 14, borderWidth: 1, borderRadius: 10 }}>
                <Text style={{ textAlign: 'center', fontWeight: '600' }}>{t('common.korean')}</Text>
            </Pressable>

            <Pressable onPress={() => pick('en')} style={{ padding: 14, borderWidth: 1, borderRadius: 10 }}>
                <Text style={{ textAlign: 'center', fontWeight: '600' }}>{t('common.english')}</Text>
            </Pressable>
        </View>
    );
}

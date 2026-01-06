import { Stack } from 'expo-router';
import { t } from '../../src/i18n';
import { useLocale } from '../../src/i18n/LocaleProvider';

export default function ModalLayout() {
    const { locale } = useLocale();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#fff',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                },
                headerTintColor: '#111',
                headerTitleStyle: { fontWeight: '700' },
                headerBackTitleVisible: false, // "Back" 텍스트 숨기고 아이콘만
                // headerBackImageSource: require('../../assets/back-icon.png'), // 커스텀 백 아이콘 (선택)
            }}
            key={locale}
        >
            <Stack.Screen
                name="daily-checkin"
                options={{
                    headerShown: true,
                    title: t('nav.dailyCheckinTitle'),
                }}
            />
        </Stack>
    );
}

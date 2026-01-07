import {Stack} from 'expo-router';
import {LocaleProvider, useLocale} from '../src/i18n/LocaleProvider';
import {SafeAreaProvider} from "react-native-safe-area-context";
import {StatusBar} from "react-native";

function RootStack() {
    const {locale} = useLocale();

    return (
        <>
            <StatusBar backgroundColor="#FFA07A" barStyle="dark-content"/>
            <Stack key={locale}>
                <Stack.Screen name="index" options={{headerShown: false}}/>
                <Stack.Screen name="language" options={{headerShown: false}}/>
                <Stack.Screen name="onboarding" options={{headerShown: false}}/>
                <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
                <Stack.Screen
                    name="modal"
                    options={{
                        presentation: 'modal',
                        headerShown: false, // 모달 자체 헤더는 안 보이게(내부 레이아웃에서 관리)
                        animation: 'slide_from_bottom', // iOS 스타일 애니메이션
                        gestureEnabled: true, // 스와이프 제스처
                    }}
                />

            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <LocaleProvider>
                <RootStack/>
            </LocaleProvider>
        </SafeAreaProvider>
    );
}

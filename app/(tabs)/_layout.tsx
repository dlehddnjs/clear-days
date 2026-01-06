import {Tabs} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {t} from '../../src/i18n';
import {useLocale} from '../../src/i18n/LocaleProvider';

export default function TabsLayout() {
    const {locale} = useLocale();

    return (
        <Tabs
            key={locale}
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#3b82f6',
                tabBarInactiveTintColor: '#9ca3af',
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabs.calendar'),
                    tabBarIcon: ({color, size, focused}: { color: string; size: number; focused: boolean }) => (
                        <Ionicons name={focused ? "calendar" : "calendar-outline"} size={size} color={color}/>
                    ),
                }}
            />
            <Tabs.Screen
                name="insights"
                options={{
                    title: t('tabs.insights'),
                    tabBarIcon: ({color, size, focused}: { color: string; size: number; focused: boolean }) => (
                        <Ionicons name={focused ? "bulb" : "bulb-outline"} size={size} color={color}/>
                    ),
                }}
            />
            <Tabs.Screen
                name="experiments"
                options={{
                    title: t('tabs.experiments'),
                    tabBarIcon: ({color, size, focused}: { color: string; size: number; focused: boolean }) => (
                        <Ionicons name={focused ? "flask" : "flask-outline"} size={size} color={color}/>
                    ),
                }}
            />
            <Tabs.Screen
                name="report"
                options={{
                    title: t('tabs.report'),
                    tabBarIcon: ({color, size, focused}: { color: string; size: number; focused: boolean }) => (
                        <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={size} color={color}/>
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('tabs.settings'),
                    tabBarIcon: ({color, size, focused}: { color: string; size: number; focused: boolean }) => (
                        <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color}/>
                    ),
                }}
            />
            <Tabs.Screen
                name="report-share"
                options={{
                    href: null,
                    title: t('tabs.report'),
                }}
            />
        </Tabs>
    );
}

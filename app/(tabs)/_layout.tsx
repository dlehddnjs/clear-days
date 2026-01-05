import { Tabs } from 'expo-router';

export default function TabsLayout() {
    return (
        <Tabs>
            <Tabs.Screen name="index" options={{ title: 'Calendar' }} />
            <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
            <Tabs.Screen name="experiments" options={{ title: '실험' }} />
            <Tabs.Screen name="report" options={{ title: '리포트' }} />
            <Tabs.Screen name="settings" options={{ title: '설정' }} />
        </Tabs>
    );
}

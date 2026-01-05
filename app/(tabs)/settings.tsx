import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotificationSettings, saveNotificationSettings } from '../../src/notifications/settings';
import { cancelAllReminders, scheduleCustomReminders, requestNotificationPermissions } from '../../src/notifications/notif';

export default function SettingsScreen() {
    const [loaded, setLoaded] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [mode, setMode] = useState<'none' | 'morning' | 'evening' | 'both'>('both');

    const [morningHour, setMorningHour] = useState(8);
    const [morningMinute, setMorningMinute] = useState(0);
    const [eveningHour, setEveningHour] = useState(21);
    const [eveningMinute, setEveningMinute] = useState(0);

    useEffect(() => {
        (async () => {
            const s = await getNotificationSettings();
            setEnabled(s.enabled);
            setMode(s.mode);
            setMorningHour(s.morningHour);
            setMorningMinute(s.morningMinute);
            setEveningHour(s.eveningHour);
            setEveningMinute(s.eveningMinute);
            setLoaded(true);
        })();
    }, []);

    const save = async () => {
        const next = { enabled, mode, morningHour, morningMinute, eveningHour, eveningMinute };
        await saveNotificationSettings(next);

        if (!enabled || mode === 'none') {
            await cancelAllReminders();
            Alert.alert('저장됨', '알림을 끄고 저장했어요.');
            return;
        }

        const ok = await requestNotificationPermissions();
        if (!ok) {
            Alert.alert('권한 필요', '알림 권한이 없어 설정을 적용할 수 없어요.');
            return;
        }

        await scheduleCustomReminders();
        Alert.alert('저장됨', '알림 설정이 적용됐어요.');
    };

    const resetOnboarding = async () => {
        await AsyncStorage.removeItem('hasCompletedOnboarding');
        Alert.alert('완료', '온보딩을 초기화했어요. 앱을 재실행하면 다시 보여요.');
    };

    if (!loaded) return null;

    const showMorning = enabled && (mode === 'morning' || mode === 'both');
    const showEvening = enabled && (mode === 'evening' || mode === 'both');

    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 16 }}>설정</Text>

            <View style={{ padding: 14, borderRadius: 10, backgroundColor: 'white', borderWidth: 1, borderColor: '#eee' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>알림</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text>알림 받기</Text>
                    <Pressable onPress={() => setEnabled((p) => !p)}>
                        <Text style={{ fontWeight: '600' }}>{enabled ? 'ON' : 'OFF'}</Text>
                    </Pressable>
                </View>

                <Text style={{ marginTop: 8, marginBottom: 6 }}>빈도</Text>
                <View style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                    <Picker selectedValue={mode} onValueChange={(v) => setMode(v)}>
                        <Picker.Item label="안받음" value="none" />
                        <Picker.Item label="아침" value="morning" />
                        <Picker.Item label="저녁" value="evening" />
                        <Picker.Item label="아침 및 저녁" value="both" />
                    </Picker>
                </View>

                {showMorning && (
                    <>
                        <Text style={{ marginTop: 12, marginBottom: 6 }}>아침 시간</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                                <Picker selectedValue={morningHour} onValueChange={(v) => setMorningHour(v)}>
                                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                                        <Picker.Item key={h} label={`${h}시`} value={h} />
                                    ))}
                                </Picker>
                            </View>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                                <Picker selectedValue={morningMinute} onValueChange={(v) => setMorningMinute(v)}>
                                    {[0, 5, 10, 15, 20, 30, 40, 45, 50, 55].map((m) => (
                                        <Picker.Item key={m} label={`${m}분`} value={m} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    </>
                )}

                {showEvening && (
                    <>
                        <Text style={{ marginTop: 12, marginBottom: 6 }}>저녁 시간</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                                <Picker selectedValue={eveningHour} onValueChange={(v) => setEveningHour(v)}>
                                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                                        <Picker.Item key={h} label={`${h}시`} value={h} />
                                    ))}
                                </Picker>
                            </View>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                                <Picker selectedValue={eveningMinute} onValueChange={(v) => setEveningMinute(v)}>
                                    {[0, 5, 10, 15, 20, 30, 40, 45, 50, 55].map((m) => (
                                        <Picker.Item key={m} label={`${m}분`} value={m} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    </>
                )}

                <Pressable onPress={save} style={{ marginTop: 14, padding: 12, backgroundColor: '#111', borderRadius: 8 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>알림 설정 저장</Text>
                </Pressable>
            </View>

            <Pressable
                onPress={resetOnboarding}
                style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}
            >
                <Text style={{ textAlign: 'center' }}>온보딩 다시 보기</Text>
            </Pressable>
        </ScrollView>
    );
}

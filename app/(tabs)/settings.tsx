import {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, Text, View} from 'react-native';
import {Picker} from '@react-native-picker/picker';

import {t} from '../../src/i18n';
import {useLocale} from '../../src/i18n/LocaleProvider';
import {getNotificationSettings, saveNotificationSettings} from '../../src/notifications/settings';
import {cancelAllReminders, requestPermissionsAsync, scheduleCustomReminders} from '../../src/notifications/notif';
import {deleteAllData} from "../../src/db/repo";
import {SafeAreaView} from "react-native-safe-area-context";

export default function SettingsScreen() {
    const {locale, setLocale} = useLocale();

    const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);
    const [notif, setNotif] = useState<any>({
        enabled: true,
        morning: true,
        evening: true,
        morningHour: 8,
        eveningHour: 21,
    });

    useEffect(() => {
        (async () => {
            const loaded = await getNotificationSettings();
            setNotif(loaded);
        })();
    }, []);

    const update = (key: string, value: any) => setNotif((p: any) => ({...p, [key]: value}));

    const deriveFlags = (mode: 'none' | 'morning' | 'evening' | 'both') => {
        if (mode === 'none') return {enabled: false, morning: false, evening: false};
        if (mode === 'morning') return {enabled: true, morning: true, evening: false};
        if (mode === 'evening') return {enabled: true, morning: false, evening: true};
        return {enabled: true, morning: true, evening: true};
    };

    const getMode = () => {
        if (!notif.enabled) return 'none';
        if (notif.morning && notif.evening) return 'both';
        if (notif.morning) return 'morning';
        if (notif.evening) return 'evening';
        return 'none';
    };

    const ensurePermissionIfNeeded = async () => {
        if (!notif.enabled) return true;
        const ok = await requestPermissionsAsync();
        if (!ok) {
            Alert.alert(t('settingsScreen.permissionNeed'), t('settingsScreen.permissionDesc'), [{text: t('common.ok')}]);
            return false;
        }
        return true;
    };

    const save = async () => {
        const ok = await ensurePermissionIfNeeded();
        if (!ok) return;

        await saveNotificationSettings(notif);

        if (notif.enabled) await scheduleCustomReminders();
        else await cancelAllReminders();

        Alert.alert(t('settingsScreen.saved'), t('settingsScreen.savedDesc'), [{text: t('common.ok')}]);
    };

    const changeLanguage = async (next: 'ko' | 'en') => {
        await setLocale(next);
        if (notif.enabled) {
            const ok = await requestPermissionsAsync();
            if (ok) await scheduleCustomReminders();
        }
    };

    const handleDeleteAllData = () => {
        Alert.alert(
            t('settings.deleteTitle'),
            t('settings.deleteWarning'),
            [
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                },
                {
                    text: t('settings.deleteConfirm'),
                    style: 'destructive',
                    onPress: showCountdownAlert,
                },
            ]
        );
    };

    const showCountdownAlert = () => {
        let countdown = 5;
        setDeleteCountdown(countdown);

        const timer = setInterval(() => {
            countdown--;
            setDeleteCountdown(countdown);

            if (countdown === 0) {
                clearInterval(timer);
                Alert.alert(
                    t('settings.deleteTitle'),
                    t('settings.deleteWarning'),
                    [
                        {
                            text: t('common.cancel'),
                            style: 'cancel',
                            onPress: () => setDeleteCountdown(null),
                        },
                        {
                            text: t('settings.deleteConfirm'),
                            onPress: executeDelete,
                            style: 'destructive',
                        },
                    ]
                );
            }
        }, 1000);

        const showCountdown = () => {
            if (countdown > 0) {
                Alert.alert(
                    t('settings.countdownTitle', {seconds: countdown}),
                    t('settings.countdownMsg'),
                    [
                        {
                            text: t('common.cancel'),
                            onPress: () => {
                                clearInterval(timer);
                                setDeleteCountdown(null);
                            },
                            style: 'cancel',
                        },
                    ],
                    {cancelable: false}
                );
            }
        };

        showCountdown();
    };

    const executeDelete = async () => {
        try {
            await deleteAllData();
            setDeleteCountdown(null);
            Alert.alert(
                t('settings.deleteSuccess'),
                t('settings.deleteSuccessMsg'),
                [{text: 'OK'}]
            );
        } catch (error) {
            Alert.alert(t('settings.errorTitle'), t('settings.errorMsg'));
        }
    };

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: '#f9fafb'}} edges={['top', 'left', 'right']}>
            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 32}}>
                {/* ✅ 헤더 */}
                <View style={{marginBottom: 24}}>
                    <Text style={{fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 4}}>
                        ⚙️ {t('settingsScreen.title')}
                    </Text>
                    <Text style={{fontSize: 14, color: '#6b7280'}}>
                        {t('settings.description')}
                    </Text>
                </View>

                {/* ✅ 언어 설정 */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                        <Text style={{fontSize: 20, marginRight: 8}}>🌐</Text>
                        <Text style={{fontSize: 18, fontWeight: '700', color: '#111', flex: 1}}>
                            {t('common.language')}
                        </Text>
                    </View>

                    <View style={{flexDirection: 'row', gap: 10}}>
                        <Pressable
                            onPress={() => changeLanguage('ko')}
                            style={{
                                flex: 1,
                                padding: 14,
                                borderRadius: 12,
                                backgroundColor: locale === 'ko' ? '#111' : '#f3f4f6',
                                borderWidth: 2,
                                borderColor: locale === 'ko' ? '#111' : 'transparent',
                            }}
                        >
                            <Text style={{
                                textAlign: 'center',
                                fontWeight: '700',
                                fontSize: 15,
                                color: locale === 'ko' ? 'white' : '#6b7280'
                            }}>
                                {locale === 'ko' && '✓ '}{t('common.korean')}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => changeLanguage('en')}
                            style={{
                                flex: 1,
                                padding: 14,
                                borderRadius: 12,
                                backgroundColor: locale === 'en' ? '#111' : '#f3f4f6',
                                borderWidth: 2,
                                borderColor: locale === 'en' ? '#111' : 'transparent',
                            }}
                        >
                            <Text style={{
                                textAlign: 'center',
                                fontWeight: '700',
                                fontSize: 15,
                                color: locale === 'en' ? 'white' : '#6b7280'
                            }}>
                                {locale === 'en' && '✓ '}{t('common.english')}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* ✅ 알림 설정 */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                        <Text style={{fontSize: 20, marginRight: 8}}>🔔</Text>
                        <Text style={{fontSize: 18, fontWeight: '700', color: '#111', flex: 1}}>
                            {t('settingsScreen.remindersTitle')}
                        </Text>
                        <View style={{
                            backgroundColor: notif.enabled ? '#dcfce7' : '#f3f4f6',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                        }}>
                            <Text style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: notif.enabled ? '#059669' : '#6b7280'
                            }}>
                                {notif.enabled ? 'ON' : 'OFF'}
                            </Text>
                        </View>
                    </View>

                    <View style={{marginBottom: 14}}>
                        <Text style={{fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 8}}>
                            {t('settingsScreen.frequency')}
                        </Text>
                        <View style={{
                            borderWidth: 2,
                            borderColor: '#e5e7eb',
                            borderRadius: 12,
                            overflow: 'hidden',
                            backgroundColor: '#fafafa'
                        }}>
                            <Picker
                                selectedValue={getMode()}
                                onValueChange={(mode) => {
                                    const flags = deriveFlags(mode);
                                    update('enabled', flags.enabled);
                                    update('morning', flags.morning);
                                    update('evening', flags.evening);
                                }}
                            >
                                <Picker.Item label={t('settingsScreen.none')} value="none"/>
                                <Picker.Item label={t('settingsScreen.morning')} value="morning"/>
                                <Picker.Item label={t('settingsScreen.evening')} value="evening"/>
                                <Picker.Item label={t('settingsScreen.both')} value="both"/>
                            </Picker>
                        </View>
                    </View>

                    {notif.enabled && notif.morning && (
                        <View style={{marginBottom: 14}}>
                            <Text style={{fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 8}}>
                                ☀️ {t('settingsScreen.morningTime')}
                            </Text>
                            <View style={{
                                borderWidth: 2,
                                borderColor: '#e5e7eb',
                                borderRadius: 12,
                                overflow: 'hidden',
                                backgroundColor: '#fafafa'
                            }}>
                                <Picker selectedValue={notif.morningHour}
                                        onValueChange={(v) => update('morningHour', v)}>
                                    {Array.from({length: 12}, (_, i) => i + 6).map((h) => (
                                        <Picker.Item key={h} label={`${h}:00`} value={h}/>
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}

                    {notif.enabled && notif.evening && (
                        <View style={{marginBottom: 14}}>
                            <Text style={{fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 8}}>
                                🌙 {t('settingsScreen.eveningTime')}
                            </Text>
                            <View style={{
                                borderWidth: 2,
                                borderColor: '#e5e7eb',
                                borderRadius: 12,
                                overflow: 'hidden',
                                backgroundColor: '#fafafa'
                            }}>
                                <Picker selectedValue={notif.eveningHour}
                                        onValueChange={(v) => update('eveningHour', v)}>
                                    {Array.from({length: 6}, (_, i) => i + 18).map((h) => (
                                        <Picker.Item key={h} label={`${h}:00`} value={h}/>
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}

                    <Pressable
                        onPress={save}
                        style={({pressed}) => ({
                            padding: 14,
                            backgroundColor: pressed ? '#1f2937' : '#111',
                            borderRadius: 12,
                        })}
                    >
                        <Text style={{color: 'white', textAlign: 'center', fontWeight: '700', fontSize: 15}}>
                            💾 {t('settingsScreen.save')}
                        </Text>
                    </Pressable>
                </View>

                {/* ✅ 위험 구역 */}
                <View style={{
                    backgroundColor: '#fef2f2',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 2,
                    borderColor: '#fecaca',
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12}}>
                        <Text style={{fontSize: 20, marginRight: 8}}>⚠️</Text>
                        <Text style={{fontSize: 13, color: '#991b1b', flex: 1, lineHeight: 18}}>
                            {t('settings.dangerZoneWarning')}
                        </Text>
                    </View>

                    <Pressable
                        onPress={handleDeleteAllData}
                        style={({pressed}) => ({
                            padding: 14,
                            backgroundColor: pressed ? '#b91c1c' : '#dc2626',
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: '#991b1b',
                        })}
                    >
                        <Text style={{
                            color: 'white',
                            fontWeight: '800',
                            textAlign: 'center',
                            fontSize: 15,
                        }}>
                            {t('settings.deleteAll')}
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

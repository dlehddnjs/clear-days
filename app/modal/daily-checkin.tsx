import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';

import { t } from '../../src/i18n';
import {
    getDailyLog,
    upsertDailyLog,
    listFoodsForDate,
    replaceFoodsForDate,
    getHabitLog,
    upsertHabitLog,
    DbWriteError,
} from '../../src/db/repo';
import { scheduleCustomReminders } from '../../src/notifications/notif';

const FOOD_CATEGORIES = [
    'refined_carbs',
    'whole_grain',
    'dairy',
    'alcohol',
    'fried_fat',
    'spicy',
] as const;

export default function DailyCheckinModal() {
    const router = useRouter();
    const { date } = useLocalSearchParams<{ date?: string }>();
    const dateKey = typeof date === 'string' ? date : new Date().toISOString().slice(0, 10);

    const [skinScore, setSkinScore] = useState<0 | 1 | 2>(1);
    const [itch, setItch] = useState(false);
    const [pain, setPain] = useState(false);
    const [selectedFoods, setSelectedFoods] = useState<string[]>([]);

    const [pillowcase, setPillowcase] = useState(false);
    const [exercise, setExercise] = useState(false);
    const [stressLevel, setStressLevel] = useState<0 | 1 | 2>(0);
    const [sleepHours, setSleepHours] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            const log = await getDailyLog(dateKey);
            if (log) {
                setSkinScore(log.skin_score);
                setItch(!!log.itch);
                setPain(!!log.pain);
            }

            const foods = await listFoodsForDate(dateKey);
            setSelectedFoods(foods.map((f) => f.category));

            const habit = await getHabitLog(dateKey);
            if (habit) {
                setPillowcase(!!habit.pillowcase);
                setExercise(!!habit.exercise);
                setStressLevel(habit.stress_level);
                setSleepHours(habit.sleep_hours ?? null);
            }
        })();
    }, [dateKey]);

    const toggleFood = (key: string) => {
        setSelectedFoods((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    };

    const showDbError = (e: unknown) => {
        const msg = e instanceof DbWriteError ? e.message : t('checkin.savedFailStorage');
        Alert.alert(
            t('checkin.savedFailTitle'),
            msg.includes('disk') || msg.includes('full') ? t('checkin.savedFailStorage') : msg,
            [{ text: t('common.ok') }]
        );
    };

    const save = async () => {
        try {
            await upsertDailyLog({
                date: dateKey,
                skin_score: skinScore,
                itch: itch ? 1 : 0,
                pain: pain ? 1 : 0,
                note: null,
            });

            await replaceFoodsForDate(dateKey, selectedFoods);

            await upsertHabitLog({
                date: dateKey,
                pillowcase: pillowcase ? 1 : 0,
                sleep_hours: sleepHours,
                stress_level: stressLevel,
                exercise: exercise ? 1 : 0,
            });

            await scheduleCustomReminders();
            router.back();
        } catch (e) {
            showDbError(e);
        }
    };

    const skinButtons = useMemo(
        () => [
            { value: 0 as const, label: t('checkin.none') },
            { value: 1 as const, label: t('checkin.mild') },
            { value: 2 as const, label: t('checkin.severe') },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t('common.language')]
    );

    const sleepButtons = useMemo(
        () => [
            { v: null as number | null, label: t('checkin.sleepNone') },
            { v: 6, label: t('checkin.sleep6') },
            { v: 7, label: t('checkin.sleep7') },
            { v: 9, label: t('checkin.sleep9') },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t('common.language')]
    );

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>
                {t('checkin.title')} · {dateKey}
            </Text>

            <Text style={{ fontSize: 14, color: '#666' }}>{t('checkin.skinLabel')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {skinButtons.map((b) => (
                    <Pressable
                        key={b.value}
                        onPress={() => setSkinScore(b.value)}
                        style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: skinScore === b.value ? '#111' : '#e5e7eb',
                            backgroundColor: skinScore === b.value ? '#111' : 'white',
                        }}
                    >
                        <Text style={{ textAlign: 'center', color: skinScore === b.value ? 'white' : '#111' }}>
                            {b.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                    onPress={() => setItch((v) => !v)}
                    style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: itch ? '#111' : '#e5e7eb',
                        backgroundColor: itch ? '#111' : 'white',
                    }}
                >
                    <Text style={{ textAlign: 'center', color: itch ? 'white' : '#111' }}>{t('checkin.itch')}</Text>
                </Pressable>

                <Pressable
                    onPress={() => setPain((v) => !v)}
                    style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: pain ? '#111' : '#e5e7eb',
                        backgroundColor: pain ? '#111' : 'white',
                    }}
                >
                    <Text style={{ textAlign: 'center', color: pain ? 'white' : '#111' }}>{t('checkin.pain')}</Text>
                </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: '#666', marginTop: 8 }}>{t('checkin.foodLabel')}</Text>
            <View style={{ gap: 8 }}>
                {FOOD_CATEGORIES.map((key) => {
                    const active = selectedFoods.includes(key);
                    return (
                        <Pressable
                            key={key}
                            onPress={() => toggleFood(key)}
                            style={{
                                padding: 12,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: active ? '#111' : '#e5e7eb',
                                backgroundColor: active ? '#111' : 'white',
                            }}
                        >
                            <Text style={{ color: active ? 'white' : '#111' }}>{t(`food.${key}`)}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={{ fontSize: 14, color: '#666', marginTop: 8 }}>{t('checkin.habitsLabel')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                    onPress={() => setPillowcase((v) => !v)}
                    style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: pillowcase ? '#111' : '#e5e7eb',
                        backgroundColor: pillowcase ? '#111' : 'white',
                    }}
                >
                    <Text style={{ textAlign: 'center', color: pillowcase ? 'white' : '#111' }}>
                        {t('checkin.pillowcase')}
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => setExercise((v) => !v)}
                    style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: exercise ? '#111' : '#e5e7eb',
                        backgroundColor: exercise ? '#111' : 'white',
                    }}
                >
                    <Text style={{ textAlign: 'center', color: exercise ? 'white' : '#111' }}>{t('checkin.exercise')}</Text>
                </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: '#666' }}>{t('checkin.stress')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                    { v: 0 as const, label: t('checkin.stress0') },
                    { v: 1 as const, label: t('checkin.stress1') },
                    { v: 2 as const, label: t('checkin.stress2') },
                ].map((x) => (
                    <Pressable
                        key={x.v}
                        onPress={() => setStressLevel(x.v)}
                        style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: stressLevel === x.v ? '#111' : '#e5e7eb',
                            backgroundColor: stressLevel === x.v ? '#111' : 'white',
                        }}
                    >
                        <Text style={{ textAlign: 'center', color: stressLevel === x.v ? 'white' : '#111' }}>{x.label}</Text>
                    </Pressable>
                ))}
            </View>

            <Text style={{ fontSize: 14, color: '#666' }}>{t('checkin.sleep')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {sleepButtons.map((x) => (
                    <Pressable
                        key={String(x.v)}
                        onPress={() => setSleepHours(x.v)}
                        style={{
                            flex: 1,
                            padding: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: sleepHours === x.v ? '#111' : '#e5e7eb',
                            backgroundColor: sleepHours === x.v ? '#111' : 'white',
                        }}
                    >
                        <Text style={{ textAlign: 'center', color: sleepHours === x.v ? 'white' : '#111' }}>{x.label}</Text>
                    </Pressable>
                ))}
            </View>

            <Pressable onPress={save} style={{ marginTop: 12, padding: 14, backgroundColor: '#111', borderRadius: 12 }}>
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{t('common.save')}</Text>
            </Pressable>

            <Pressable
                onPress={() => router.back()}
                style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}
            >
                <Text style={{ textAlign: 'center' }}>{t('common.close')}</Text>
            </Pressable>
        </ScrollView>
    );
}

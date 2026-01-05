import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
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
    { key: 'refined_carbs', label: '정제탄수(빵/면/라면/디저트)' },
    { key: 'whole_grain', label: '통곡/저GI' },
    { key: 'dairy', label: '유제품' },
    { key: 'alcohol', label: '술' },
    { key: 'fried_fat', label: '튀김/고지방' },
    { key: 'spicy', label: '매운/자극' },
];

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
        const msg = e instanceof DbWriteError ? e.message : '저장 중 오류가 발생했어요.';
        Alert.alert(
            '저장 실패',
            msg.includes('disk') || msg.includes('full')
                ? '휴대폰 저장 공간이 부족할 수 있어요. 용량 확보 후 다시 시도해주세요.'
                : msg
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

            await scheduleCustomReminders(); // 사용자가 설정한 값 기준으로 재스케줄
            router.back();
        } catch (e) {
            showDbError(e);
        }
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600' }}>{dateKey} 기록</Text>

            <Text>오늘 피부(없음/조금/많이)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 1, 2].map((v) => (
                    <Pressable
                        key={v}
                        onPress={() => setSkinScore(v as 0 | 1 | 2)}
                        style={{
                            padding: 10,
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: skinScore === v ? '#111' : '#ccc',
                            flex: 1,
                        }}
                    >
                        <Text style={{ textAlign: 'center' }}>{v === 0 ? '없음' : v === 1 ? '조금' : '많이'}</Text>
                    </Pressable>
                ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => setItch(!itch)} style={{ padding: 10, borderWidth: 1, borderRadius: 8, flex: 1 }}>
                    <Text style={{ textAlign: 'center' }}>가려움: {itch ? 'ON' : 'OFF'}</Text>
                </Pressable>
                <Pressable onPress={() => setPain(!pain)} style={{ padding: 10, borderWidth: 1, borderRadius: 8, flex: 1 }}>
                    <Text style={{ textAlign: 'center' }}>통증: {pain ? 'ON' : 'OFF'}</Text>
                </Pressable>
            </View>

            <Text>음식 카테고리(선택, 여러 개 가능)</Text>
            <View style={{ gap: 8 }}>
                {FOOD_CATEGORIES.map((c) => (
                    <Pressable
                        key={c.key}
                        onPress={() => toggleFood(c.key)}
                        style={{ padding: 10, borderWidth: 1, borderRadius: 8 }}
                    >
                        <Text>{selectedFoods.includes(c.key) ? '[x] ' : '[ ] '}{c.label}</Text>
                    </Pressable>
                ))}
            </View>

            <Text style={{ marginTop: 8 }}>빠른 습관 체크(선택)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => setPillowcase(!pillowcase)} style={{ padding: 10, borderWidth: 1, borderRadius: 8, flex: 1 }}>
                    <Text style={{ textAlign: 'center' }}>베개커버 교체: {pillowcase ? '✅' : '❌'}</Text>
                </Pressable>
                <Pressable onPress={() => setExercise(!exercise)} style={{ padding: 10, borderWidth: 1, borderRadius: 8, flex: 1 }}>
                    <Text style={{ textAlign: 'center' }}>운동: {exercise ? '✅' : '❌'}</Text>
                </Pressable>
            </View>

            <Text>스트레스</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 1, 2].map((v) => (
                    <Pressable
                        key={v}
                        onPress={() => setStressLevel(v as 0 | 1 | 2)}
                        style={{
                            padding: 10,
                            borderWidth: 1,
                            borderRadius: 8,
                            flex: 1,
                            borderColor: stressLevel === v ? '#111' : '#ccc',
                        }}
                    >
                        <Text style={{ textAlign: 'center' }}>{v === 0 ? '없음' : v === 1 ? '보통' : '높음'}</Text>
                    </Pressable>
                ))}
            </View>

            <Text>수면시간(선택)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                    { label: '미기록', val: null },
                    { label: '6h', val: 6 },
                    { label: '7h', val: 7 },
                    { label: '8h', val: 8 },
                    { label: '9h+', val: 9 },
                ].map((o) => (
                    <Pressable
                        key={String(o.val)}
                        onPress={() => setSleepHours(o.val)}
                        style={{
                            padding: 10,
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: sleepHours === o.val ? '#111' : '#ccc',
                            flex: 1,
                        }}
                    >
                        <Text style={{ textAlign: 'center' }}>{o.label}</Text>
                    </Pressable>
                ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable onPress={() => router.back()} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 8 }}>
                    <Text style={{ textAlign: 'center' }}>닫기</Text>
                </Pressable>
                <Pressable onPress={save} style={{ flex: 1, padding: 12, backgroundColor: '#111', borderRadius: 8 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>저장</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

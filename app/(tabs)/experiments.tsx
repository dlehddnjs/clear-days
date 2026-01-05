import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { createExperiment, getActiveExperiments, getExperimentProgress } from '../../src/db/repo';

const PRESET_EXPERIMENTS = [
    { name: '정제탄수 줄이기', target_food: 'refined_carbs', target_days: 14, max_eat_days: 2 },
    { name: '유제품 줄이기', target_food: 'dairy', target_days: 14, max_eat_days: 2 },
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function ExperimentsScreen() {
    const [active, setActive] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const exps = await getActiveExperiments();
        const withProgress = await Promise.all(
            exps.map(async (e) => ({ ...e, progress: await getExperimentProgress(e) }))
        );
        setActive(withProgress);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const startPreset = async (preset: any) => {
        const start = new Date();
        const end = new Date(start.getTime() + preset.target_days * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);

        await createExperiment({
            name: preset.name,
            target_food: preset.target_food,
            target_days: preset.target_days,
            max_eat_days: preset.max_eat_days,
            start_date: isoDate(start),
            end_date: isoDate(end),
        });

        Alert.alert('실험 시작', `${preset.name} (${preset.target_days}일) 시작했어요.`);
        await load();
    };

    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>진행 중 실험</Text>

            {loading ? (
                <Text>Loading…</Text>
            ) : active.length === 0 ? (
                <Text style={{ color: '#666', marginBottom: 24 }}>진행 중인 실험이 없어요.</Text>
            ) : (
                active.map((exp) => {
                    const p = exp.progress;
                    const remaining = Math.max(0, exp.max_eat_days - p.currentEatDays);
                    const achievement = exp.max_eat_days === 0 ? 100 : Math.round((remaining / exp.max_eat_days) * 100);

                    return (
                        <View
                            key={exp.id}
                            style={{ padding: 16, marginBottom: 12, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#eee' }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: '600' }}>{exp.name}</Text>
                            <Text style={{ color: '#666', marginTop: 4 }}>
                                기간: {exp.start_date} ~ {exp.end_date}
                            </Text>
                            <Text style={{ marginTop: 8 }}>
                                먹은 날: {p.currentEatDays}/{exp.max_eat_days} (달성도 {achievement}%)
                            </Text>
                            <Text style={{ marginTop: 4 }}>
                                (먹은 날 기준) 다음날 악화: {p.nextDayBadCount}회 ({p.nextDayBadRate})
                            </Text>
                        </View>
                    );
                })
            )}

            <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 12 }}>새 실험 시작</Text>
            {PRESET_EXPERIMENTS.map((preset) => (
                <Pressable
                    key={preset.target_food}
                    onPress={() => startPreset(preset)}
                    style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 }}
                >
                    <Text style={{ fontWeight: '600' }}>{preset.name}</Text>
                    <Text style={{ color: '#64748b', marginTop: 4 }}>
                        {preset.target_days}일 중 {preset.max_eat_days}일 이하
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

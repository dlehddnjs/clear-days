import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { getFoodLagInsights, getHabitInsights } from '../../src/db/repo';

const FOOD_LABELS: Record<string, string> = {
    refined_carbs: '정제탄수(빵/면/라면/디저트)',
    whole_grain: '통곡/저GI',
    dairy: '유제품',
    alcohol: '술',
    fried_fat: '튀김/고지방',
    spicy: '매운/자극',
};

export default function InsightsScreen() {
    const [viewPeriod, setViewPeriod] = useState<'7d' | '30d'>('7d');
    const [loading, setLoading] = useState(true);

    const [insights7d, setInsights7d] = useState<Record<string, any>>({});
    const [insights30d, setInsights30d] = useState<Record<string, any>>({});
    const [habitInsights, setHabitInsights] = useState<Array<{ factor: string; count: number; avg_score: number | null }>>(
        []
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            (async () => {
                setLoading(true);
                try {
                    const [i7, i30, h30] = await Promise.all([
                        getFoodLagInsights(7),
                        getFoodLagInsights(30),
                        getHabitInsights(30),
                    ]);
                    setInsights7d(i7);
                    setInsights30d(i30);
                    setHabitInsights(h30);
                } finally {
                    setLoading(false);
                }
            })();
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    const insights = useMemo(() => (viewPeriod === '7d' ? insights7d : insights30d), [viewPeriod, insights7d, insights30d]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>인사이트 계산 중…</Text>
            </View>
        );
    }

    const entries = Object.entries(insights).sort(([, a]: any, [, b]: any) => (b.rateNum ?? 0) - (a.rateNum ?? 0));

    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
                <Pressable
                    onPress={() => setViewPeriod('7d')}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: viewPeriod === '7d' ? '#111' : '#f3f4f6' }}
                >
                    <Text style={{ textAlign: 'center', color: viewPeriod === '7d' ? 'white' : 'black' }}>최근 7일</Text>
                </Pressable>
                <Pressable
                    onPress={() => setViewPeriod('30d')}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: viewPeriod === '30d' ? '#111' : '#f3f4f6' }}
                >
                    <Text style={{ textAlign: 'center', color: viewPeriod === '30d' ? 'white' : 'black' }}>최근 30일</Text>
                </Pressable>
            </View>

            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>음식 → 다음날 악화율</Text>
            {entries.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#666', marginTop: 16 }}>
                    아직 데이터가 부족해요. 최소 7일 기록하면 패턴이 보여요.
                </Text>
            ) : (
                entries.map(([cat, data]: [string, any]) => (
                    <View
                        key={cat}
                        style={{
                            padding: 16,
                            marginBottom: 12,
                            backgroundColor: 'white',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#eee',
                        }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                            {FOOD_LABELS[cat] || cat}
                        </Text>
                        <Text style={{ color: '#666' }}>
                            {data.count}회 먹은 다음날 중 {data.badNextDay}회 ‘많이’
                        </Text>
                        <Text style={{ marginTop: 8, fontSize: 24, fontWeight: '700', color: '#e11d48' }}>
                            {data.rate}
                        </Text>
                    </View>
                ))
            )}

            <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 12 }}>습관 패턴</Text>
            {habitInsights.length === 0 ? (
                <Text style={{ color: '#666' }}>습관 데이터가 아직 부족해요(3일 이상 기록 추천).</Text>
            ) : (
                habitInsights.map((h, i) => (
                    <View
                        key={`${h.factor}-${i}`}
                        style={{
                            padding: 16,
                            marginBottom: 12,
                            backgroundColor: 'white',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#eee',
                        }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600' }}>{h.factor}</Text>
                        <Text style={{ color: '#666' }}>
                            {h.count}회, 평균 피부점수 {h.avg_score === null || Number.isNaN(h.avg_score) ? '계산중' : h.avg_score.toFixed(1)}
                        </Text>
                    </View>
                ))
            )}
        </ScrollView>
    );
}

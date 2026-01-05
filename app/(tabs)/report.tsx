import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { getWeeklyTrend, getFoodLagInsights } from '../../src/db/repo';

const screenWidth = Dimensions.get('window').width;

const FOOD_LABELS: Record<string, string> = {
    refined_carbs: '정제탄수',
    whole_grain: '통곡/저GI',
    dairy: '유제품',
    alcohol: '술',
    fried_fat: '튀김/고지방',
    spicy: '매운/자극',
};

export default function ReportScreen() {
    const reportRef = useRef<View | null>(null);

    const [loading, setLoading] = useState(true);
    const [weekly, setWeekly] = useState<Array<{ week: string; avgScore: number; count: number }>>([]);
    const [triggers, setTriggers] = useState<Record<string, { rateNum: number; rate: string; count: number; badNextDay: number }>>(
        {}
    );

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [w, t] = await Promise.all([getWeeklyTrend(28), getFoodLagInsights(14)]);
                setWeekly(w);
                setTriggers(t);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const lineData = useMemo(() => {
        // weeklyTrend가 week DESC로 오기 때문에 차트는 좌->우가 시간 흐름이 되도록 reverse
        const ordered = [...weekly].reverse();
        return {
            labels: ordered.map((w) => w.week.replace(/^(\d{4}-W)/, 'W')),
            datasets: [
                {
                    data: ordered.map((w) => Number.isFinite(w.avgScore) ? Number(w.avgScore) : 0),
                },
            ],
        };
    }, [weekly]);

    const topTriggers = useMemo(() => {
        const list = Object.entries(triggers)
            .map(([k, v]) => ({ key: k, ...v }))
            .sort((a, b) => (b.rateNum ?? 0) - (a.rateNum ?? 0))
            .slice(0, 5);

        return {
            labels: list.map((x) => FOOD_LABELS[x.key] || x.key),
            values: list.map((x) => Math.round(x.rateNum ?? 0)),
            meta: list,
        };
    }, [triggers]);

    const chartConfig = useMemo(
        () => ({
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
            propsForDots: { r: '4' },
        }),
        []
    );

    const share = async () => {
        try {
            const ok = await Sharing.isAvailableAsync();
            if (!ok) {
                Alert.alert('공유 불가', '이 기기/환경에서는 공유 기능을 사용할 수 없어요.');
                return;
            }

            if (!reportRef.current) {
                Alert.alert('오류', '리포트 영역을 찾지 못했어요. 잠시 후 다시 시도해주세요.');
                return;
            }

            // 캡처 품질/포맷은 필요에 따라 조절
            const uri = await captureRef(reportRef.current, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });

            await Sharing.shareAsync(uri, {
                dialogTitle: '피부 리포트 공유',
                mimeType: 'image/png',
                UTI: 'public.png',
            });
        } catch (e: any) {
            Alert.alert('공유 실패', e?.message ? String(e.message) : '공유 중 오류가 발생했어요.');
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: '#666' }}>리포트 생성 중…</Text>
            </View>
        );
    }

    const noWeekly = weekly.length === 0;
    const noTriggers = Object.keys(triggers).length === 0;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            <View
                ref={(r) => (reportRef.current = r)}
                collapsable={false}
                style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#eee',
                    padding: 12,
                }}
            >
                <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>주간 리포트</Text>

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>최근 4주 피부 점수(평균)</Text>
                {noWeekly ? (
                    <Text style={{ color: '#666', marginBottom: 12 }}>데이터가 부족해요(먼저 기록을 쌓아주세요).</Text>
                ) : (
                    <LineChart
                        data={lineData}
                        width={screenWidth - 16 * 2 - 12 * 2}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={{ borderRadius: 12 }}
                    />
                )}

                <View style={{ height: 16 }} />

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>최근 14일 트리거 TOP 5 (다음날 ‘많이’ 비율)</Text>
                {noTriggers ? (
                    <Text style={{ color: '#666' }}>트리거를 계산할 데이터가 부족해요(음식 기록 + 다음날 피부 기록이 필요).</Text>
                ) : (
                    <>
                        <BarChart
                            data={{
                                labels: topTriggers.labels,
                                datasets: [{ data: topTriggers.values }],
                            }}
                            width={screenWidth - 16 * 2 - 12 * 2}
                            height={260}
                            chartConfig={chartConfig}
                            fromZero
                            showValuesOnTopOfBars
                            style={{ borderRadius: 12 }}
                        />

                        <View style={{ marginTop: 10, gap: 6 }}>
                            {topTriggers.meta.map((m) => (
                                <Text key={m.key} style={{ color: '#666' }}>
                                    - {FOOD_LABELS[m.key] || m.key}: {m.rate} ({m.badNextDay}/{m.count})
                                </Text>
                            ))}
                        </View>
                    </>
                )}
            </View>

            <Pressable
                onPress={share}
                style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: '#111',
                }}
            >
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>리포트 이미지 공유</Text>
            </Pressable>

            <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
                팁: 공유 이미지는 “현재 화면에 보이는 리포트 영역” 기준으로 캡처됩니다.
            </Text>
        </ScrollView>
    );
}

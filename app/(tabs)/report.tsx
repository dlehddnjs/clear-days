import {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Dimensions, ScrollView, Text, View} from 'react-native';
import {BarChart, LineChart} from 'react-native-chart-kit';
import {useFocusEffect} from '@react-navigation/native';

import {getCurrentLocale, t} from '../../src/i18n';
import {getFoodLagInsights, getWeeklyTrend} from '../../src/db/repo';
import {SafeAreaView} from "react-native-safe-area-context";

const screenWidth = Dimensions.get('window').width;

export default function ReportScreen() {
    const [loading, setLoading] = useState(true);
    const [weekly, setWeekly] = useState<Array<{ week: string; avgScore: number; count: number }>>([]);
    const [triggers, setTriggers] = useState<Record<string, {
        rateNum: number;
        rate: string;
        count: number;
        badNextDay: number
    }>>({});

    useFocusEffect(
        useCallback(() => {
            (async () => {
                setLoading(true);
                try {
                    const [w, tgr] = await Promise.all([getWeeklyTrend(28), getFoodLagInsights(14)]);
                    setWeekly(w);
                    setTriggers(tgr);
                } finally {
                    setLoading(false);
                }
            })();
        }, [])
    );

    const formatWeekLabel = (weekStr: string): string => {
        const locale = getCurrentLocale();
        const match = weekStr.match(/(\d{4})-W(\d{2})/);
        if (!match) return weekStr;

        const year = parseInt(match[1]);
        const weekNum = parseInt(match[2]);

        const jan4 = new Date(year, 0, 4);
        const startOfWeek = new Date(jan4);
        startOfWeek.setDate(jan4.getDate() - jan4.getDay() + 1 + (weekNum - 1) * 7);

        const month = startOfWeek.getMonth();
        const weekOfMonth = Math.ceil(startOfWeek.getDate() / 7);

        if (locale === 'ko') {
            const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
            return `${monthNames[month]} ${weekOfMonth}주`;
        } else {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const suffix = weekOfMonth === 1 ? 'st' : weekOfMonth === 2 ? 'nd' : weekOfMonth === 3 ? 'rd' : 'th';
            return `${monthNames[month]} ${weekOfMonth}${suffix}`;
        }
    };

    const lineData = useMemo(() => {
        const ordered = [...weekly].reverse();
        return {
            labels: ordered.map((w) => formatWeekLabel(w.week)),
            datasets: [{data: ordered.map((w) => (Number.isFinite(w.avgScore) ? Number(w.avgScore) : 0))}],
        };
    }, [weekly]);

    const topTriggers = useMemo(() => {
        const list = Object.entries(triggers)
            .map(([k, v]) => ({key: k, ...v}))
            .sort((a, b) => (b.rateNum ?? 0) - (a.rateNum ?? 0))
            .slice(0, 5);

        return {
            labels: list.map((x) => t(`food.${x.key}`)),
            values: list.map((x) => {
                const rateStr = x.rate || '0%';
                return parseInt(rateStr.replace('%', '')) || 0;
            }),
            meta: list,
        };
    }, [triggers]);

    const trendAnalysis = useMemo(() => {
        if (weekly.length < 2) return null;
        const recent = weekly[0];
        const previous = weekly[1];
        const diff = recent.avgScore - previous.avgScore;

        if (diff < -0.3) return {emoji: '🎉', text: t('report.trendGreatImprovement'), color: '#059669'};
        if (diff < -0.1) return {emoji: '😊', text: t('report.trendImproving'), color: '#10b981'};
        if (diff > 0.3) return {emoji: '⚠️', text: t('report.trendWorsening'), color: '#dc2626'};
        if (diff > 0.1) return {emoji: '😕', text: t('report.trendSlightlyWorse'), color: '#f59e0b'};
        return {emoji: '😌', text: t('report.trendStable'), color: '#6b7280'};
    }, [weekly]);

    const getSkinScoreInterpretation = (score: number) => {
        if (score >= 1.7) return {emoji: '😰', text: t('report.scoreVeryBad'), color: '#dc2626'};
        if (score >= 1.3) return {emoji: '😟', text: t('report.scoreBad'), color: '#ef4444'};
        if (score >= 0.7) return {emoji: '😐', text: t('report.scoreMedium'), color: '#f59e0b'};
        if (score >= 0.3) return {emoji: '🙂', text: t('report.scoreGood'), color: '#10b981'};
        return {emoji: '😊', text: t('report.scoreVeryGood'), color: '#059669'};
    };

    const chartConfig = useMemo(
        () => ({
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
            propsForDots: {r: '5', strokeWidth: '2', stroke: '#3b82f6'},
            propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: '#f3f4f6',
            },
        }),
        []
    );

    const barChartConfig = useMemo(
        () => ({
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
            propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: '#f3f4f6',
            },
        }),
        []
    );

    if (loading) {
        return (
            <SafeAreaView style={{flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center'}}
                          edges={['top', 'left', 'right']}>
                <ActivityIndicator size="large" color="#3b82f6"/>
                <Text style={{marginTop: 12, color: '#666', fontSize: 15}}>{t('common.loading')}</Text>
            </SafeAreaView>
        );
    }

    const noWeekly = weekly.length === 0;
    const noTriggers = topTriggers.labels.length === 0;

    const avgScore = weekly.length > 0
        ? weekly.reduce((sum, w) => sum + w.avgScore, 0) / weekly.length
        : 0;
    const avgInterpretation = getSkinScoreInterpretation(avgScore);

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: '#f9fafb'}} edges={['top', 'left', 'right']}>
            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 24}}>
                <View style={{marginBottom: 20}}>
                    <Text style={{fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 4}}>
                        📊 {t('report.title')}
                    </Text>
                    <Text style={{fontSize: 14, color: '#6b7280'}}>
                        {t('report.description')}
                    </Text>
                </View>

                {trendAnalysis && (
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 16,
                        borderWidth: 2,
                        borderColor: trendAnalysis.color + '40',
                    }}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Text style={{fontSize: 32, marginRight: 12}}>{trendAnalysis.emoji}</Text>
                            <View style={{flex: 1}}>
                                <Text style={{fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 2}}>
                                    {t('report.thisWeekTrend')}
                                </Text>
                                <Text style={{fontSize: 16, fontWeight: '700', color: trendAnalysis.color}}>
                                    {trendAnalysis.text}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                        <Text style={{fontSize: 18, fontWeight: '700', color: '#111', flex: 1}}>
                            {t('report.skinTrend')}
                        </Text>
                        <View style={{
                            backgroundColor: '#eff6ff',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                        }}>
                            <Text style={{fontSize: 11, fontWeight: '700', color: '#3b82f6'}}>
                                {t('report.recent4weeks')}
                            </Text>
                        </View>
                    </View>

                    <View style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                    }}>
                        <Text style={{fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 8}}>
                            📍 {t('report.scoreGuide')}
                        </Text>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8}}>
                            <View style={{alignItems: 'center', minWidth: 60}}>
                                <Text style={{fontSize: 20, marginBottom: 2}}>😊</Text>
                                <Text style={{fontSize: 10, color: '#059669', fontWeight: '600'}}>
                                    {t('report.scoreClear')}
                                </Text>
                            </View>
                            <View style={{alignItems: 'center', minWidth: 60}}>
                                <Text style={{fontSize: 20, marginBottom: 2}}>😐</Text>
                                <Text style={{fontSize: 10, color: '#f59e0b', fontWeight: '600'}}>
                                    {t('report.scoreSome')}
                                </Text>
                            </View>
                            <View style={{alignItems: 'center', minWidth: 60}}>
                                <Text style={{fontSize: 20, marginBottom: 2}}>😰</Text>
                                <Text style={{fontSize: 10, color: '#dc2626', fontWeight: '600'}}>
                                    {t('report.scoreSevere')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {noWeekly ? (
                        <View style={{
                            alignItems: 'center',
                            padding: 40,
                            backgroundColor: '#f9fafb',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderStyle: 'dashed'
                        }}>
                            <Text style={{fontSize: 40, marginBottom: 8}}>📈</Text>
                            <Text style={{color: '#9ca3af', fontSize: 14, textAlign: 'center'}}>
                                {t('report.notEnough')}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <LineChart
                                data={lineData}
                                width={screenWidth - 16 * 2 - 16 * 2}
                                height={200}
                                chartConfig={chartConfig}
                                bezier
                                style={{marginVertical: 8, borderRadius: 12}}
                                withInnerLines={true}
                                withOuterLines={true}
                                withVerticalLines={false}
                                yAxisInterval={1}
                                segments={4}
                            />
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-around',
                                marginTop: 8,
                                paddingTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: '#f3f4f6'
                            }}>
                                <View style={{alignItems: 'center'}}>
                                    <Text style={{fontSize: 11, color: '#9ca3af', marginBottom: 4}}>
                                        {t('report.average')}
                                    </Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                        <Text style={{fontSize: 20}}>{avgInterpretation.emoji}</Text>
                                        <View>
                                            <Text style={{fontSize: 16, fontWeight: '700', color: '#111'}}>
                                                {avgScore.toFixed(1)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{alignItems: 'center'}}>
                                    <Text style={{fontSize: 11, color: '#9ca3af', marginBottom: 4}}>
                                        {t('report.best')}
                                    </Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                        <Text style={{fontSize: 20}}>😊</Text>
                                        <Text style={{fontSize: 16, fontWeight: '700', color: '#059669'}}>
                                            {Math.min(...weekly.map(w => w.avgScore)).toFixed(1)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{alignItems: 'center'}}>
                                    <Text style={{fontSize: 11, color: '#9ca3af', marginBottom: 4}}>
                                        {t('report.worst')}
                                    </Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                        <Text style={{fontSize: 20}}>😰</Text>
                                        <Text style={{fontSize: 16, fontWeight: '700', color: '#dc2626'}}>
                                            {Math.max(...weekly.map(w => w.avgScore)).toFixed(1)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                        <Text style={{fontSize: 18, fontWeight: '700', color: '#111', flex: 1}}>
                            {t('report.topTriggers')}
                        </Text>
                        <View style={{
                            backgroundColor: '#fef2f2',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                        }}>
                            <Text style={{fontSize: 11, fontWeight: '700', color: '#ef4444'}}>
                                {t('report.recent14days')}
                            </Text>
                        </View>
                    </View>

                    {noTriggers ? (
                        <View style={{
                            alignItems: 'center',
                            padding: 40,
                            backgroundColor: '#f9fafb',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderStyle: 'dashed'
                        }}>
                            <Text style={{fontSize: 40, marginBottom: 8}}>🍽️</Text>
                            <Text style={{color: '#9ca3af', fontSize: 14, textAlign: 'center'}}>
                                {t('report.notEnough')}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <BarChart
                                data={{labels: topTriggers.labels, datasets: [{data: topTriggers.values}]}}
                                width={screenWidth - 16 * 2 - 16 * 2}
                                height={240}
                                chartConfig={barChartConfig}
                                fromZero
                                showValuesOnTopOfBars
                                style={{marginVertical: 8, borderRadius: 12}}
                                withInnerLines={false}
                            />

                            <View style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: '#f3f4f6'
                            }}>
                                {topTriggers.meta.map((m, idx) => (
                                    <View key={m.key} style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 8,
                                        backgroundColor: idx % 2 === 0 ? '#fafafa' : 'transparent',
                                        paddingHorizontal: 8,
                                        borderRadius: 6,
                                    }}>
                                        <View style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: '#fef2f2',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 10,
                                        }}>
                                            <Text style={{fontSize: 11, fontWeight: '700', color: '#ef4444'}}>
                                                {idx + 1}
                                            </Text>
                                        </View>
                                        <Text style={{flex: 1, fontSize: 14, fontWeight: '600', color: '#111'}}>
                                            {t(`food.${m.key}`)}
                                        </Text>
                                        <Text style={{fontSize: 13, color: '#6b7280', marginRight: 8}}>
                                            {m.badNextDay}/{m.count}
                                        </Text>
                                        <Text style={{fontSize: 15, fontWeight: '700', color: '#ef4444'}}>
                                            {m.rate}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

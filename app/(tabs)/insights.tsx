import {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, Text, View} from 'react-native';
import {useFocusEffect} from 'expo-router';

import {t} from '../../src/i18n';
import {getFoodLagInsights, getHabitCorrelation} from '../../src/db/repo';
import {SafeAreaView} from "react-native-safe-area-context";

export default function InsightsScreen() {
    const [viewPeriod, setViewPeriod] = useState<'7d' | '30d'>('7d');
    const [loading, setLoading] = useState(true);
    const [insights7d, setInsights7d] = useState<any>({});
    const [insights30d, setInsights30d] = useState<any>({});
    const [habitCorrelation7d, setHabitCorrelation7d] = useState<any>(null);
    const [habitCorrelation30d, setHabitCorrelation30d] = useState<any>(null);

    const habitCorrelation = viewPeriod === '7d' ? habitCorrelation7d : habitCorrelation30d;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [i7, i30, correlation7, correlation30] = await Promise.all([
                getFoodLagInsights(7),
                getFoodLagInsights(30),
                getHabitCorrelation(7),
                getHabitCorrelation(30),
            ]);
            setInsights7d(i7);
            setInsights30d(i30);
            setHabitCorrelation7d(correlation7);
            setHabitCorrelation30d(correlation30);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 200);

        return () => clearTimeout(timer);
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const insights = viewPeriod === '7d' ? insights7d : insights30d;

    const cards = useMemo(() => {
        const entries = Object.entries(insights || {}) as any[];
        entries.sort(([, a], [, b]) => (b.rateNum ?? 0) - (a.rateNum ?? 0));
        return entries;
    }, [insights]);

    const topRiskFoods = useMemo(() => {
        return cards.filter(([, data]) => (data.rateNum ?? 0) >= 0.4).slice(0, 5);
    }, [cards]);

    if (loading) {
        return (
            <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb'}}
                          edges={['top', 'left', 'right']}>
                <ActivityIndicator/>
                <Text style={{marginTop: 8, color: '#666'}}>{t('common.loading')}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: '#f9fafb'}} edges={['top', 'left', 'right']}>
            <View style={{flex: 1, backgroundColor: '#f9fafb'}}>
                <View style={{padding: 16, paddingBottom: 0}}>
                    <View style={{flexDirection: 'row', marginBottom: 16}}>
                        <Pressable
                            onPress={() => setViewPeriod('7d')}
                            style={{
                                flex: 1,
                                padding: 12,
                                backgroundColor: viewPeriod === '7d' ? '#111' : '#fff',
                                borderRadius: 10,
                                marginRight: 8,
                                borderWidth: 1,
                                borderColor: viewPeriod === '7d' ? '#111' : '#e5e7eb',
                            }}
                        >
                            <Text style={{
                                textAlign: 'center',
                                fontWeight: '600',
                                color: viewPeriod === '7d' ? 'white' : '#666',
                            }}>
                                {t('insights.period7')}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setViewPeriod('30d')}
                            style={{
                                flex: 1,
                                padding: 12,
                                backgroundColor: viewPeriod === '30d' ? '#111' : '#fff',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: viewPeriod === '30d' ? '#111' : '#e5e7eb',
                            }}
                        >
                            <Text style={{
                                textAlign: 'center',
                                fontWeight: '600',
                                color: viewPeriod === '30d' ? 'white' : '#666',
                            }}>
                                {t('insights.period30')}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingTop: 0}}>
                    {/* 요약 카드 */}
                    <View style={{
                        padding: 20,
                        backgroundColor: topRiskFoods.length > 0 ? '#fef2f2' : '#f0fdf4',
                        borderRadius: 12,
                        marginBottom: 20,
                        borderLeftWidth: 4,
                        borderLeftColor: topRiskFoods.length > 0 ? '#ef4444' : '#10b981',
                    }}>
                        <Text style={{fontSize: 20, fontWeight: 'bold', marginBottom: 8}}>
                            🎯 {t('insights.summary')}
                        </Text>
                        <Text style={{fontSize: 15, color: '#374151', lineHeight: 22}}>
                            {topRiskFoods.length > 0
                                ? t('insights.summaryRisk', {count: topRiskFoods.length})
                                : t('insights.summaryNoRisk')}
                        </Text>
                    </View>

                    {/* 음식 트리거 분석 */}
                    <Text style={{fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#111'}}>
                        {t('insights.titleFood')}
                    </Text>

                    {cards.length === 0 ? (
                        <View style={{
                            padding: 32,
                            backgroundColor: '#fff',
                            borderRadius: 12,
                            alignItems: 'center',
                        }}>
                            <Text style={{fontSize: 48, marginBottom: 12}}>📊</Text>
                            <Text style={{textAlign: 'center', color: '#666', fontSize: 15}}>
                                {t('insights.noData')}
                            </Text>
                        </View>
                    ) : (
                        cards.map(([cat, data]) => {
                            const rateNum = data.rateNum ?? 0;
                            const isHighRisk = rateNum >= 0.6;
                            const isMediumRisk = rateNum >= 0.4 && rateNum < 0.6;
                            const isLowRisk = rateNum < 0.4;

                            return (
                                <View
                                    key={cat}
                                    style={{
                                        padding: 16,
                                        marginBottom: 12,
                                        backgroundColor: '#fff',
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: isHighRisk ? '#ef4444' : isMediumRisk ? '#f59e0b' : '#10b981',
                                    }}
                                >
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                                        <Text style={{fontSize: 32, marginRight: 12}}>
                                            {isHighRisk ? '🚨' : isMediumRisk ? '⚠️' : '✅'}
                                        </Text>
                                        <View style={{flex: 1}}>
                                            <Text style={{fontSize: 17, fontWeight: '700', color: '#111'}}>
                                                {t(`food.${cat}`)}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '600',
                                                color: isHighRisk ? '#dc2626' : isMediumRisk ? '#d97706' : '#059669',
                                                marginTop: 2,
                                            }}>
                                                {isHighRisk ? t('insights.highRisk') : isMediumRisk ? t('insights.mediumRisk') : t('insights.lowRisk')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{
                                        height: 10,
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: 5,
                                        marginBottom: 12,
                                        overflow: 'hidden',
                                    }}>
                                        <View style={{
                                            width: `${rateNum * 100}%`,
                                            height: '100%',
                                            backgroundColor: isHighRisk ? '#ef4444' : isMediumRisk ? '#f59e0b' : '#10b981',
                                            borderRadius: 5,
                                        }}/>
                                    </View>

                                    <Text style={{color: '#6b7280', fontSize: 14, marginBottom: 8}}>
                                        {t('insights.eatStats', {count: data.count, bad: data.badNextDay})}
                                    </Text>

                                    <Text style={{
                                        fontSize: 36,
                                        fontWeight: '800',
                                        color: isHighRisk ? '#dc2626' : isMediumRisk ? '#d97706' : '#059669',
                                        marginBottom: 10,
                                        letterSpacing: -1,
                                    }}>
                                        {data.rate}
                                    </Text>

                                    <View style={{
                                        padding: 12,
                                        backgroundColor: isHighRisk ? '#fef2f2' : isMediumRisk ? '#fffbeb' : '#f0fdf4',
                                        borderRadius: 8,
                                    }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: isHighRisk ? '#991b1b' : isMediumRisk ? '#92400e' : '#047857',
                                            lineHeight: 20,
                                        }}>
                                            {isHighRisk
                                                ? `⚠️ ${t('insights.avoidThis')}`
                                                : isMediumRisk
                                                    ? `💡 ${t('insights.limitThis')}`
                                                    : `✨ ${t('insights.safeToContinue')}`
                                            }
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}

                    {/* 습관 분석 */}
                    <Text style={{
                        fontSize: 18,
                        fontWeight: '700',
                        marginTop: 24,
                        marginBottom: 12,
                        color: '#111',
                    }}>
                        {t('insights.titleHabit')}
                    </Text>

                    {habitCorrelation && (
                        <>
                            {/* 베개커버 */}
                            {habitCorrelation.pillowcase.count > 0 && (
                                <View style={{
                                    padding: 16,
                                    marginBottom: 12,
                                    backgroundColor: '#fff',
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: habitCorrelation.pillowcase.rate >= 60 ? '#ef4444' : '#f59e0b',
                                }}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                                        <Text style={{fontSize: 32, marginRight: 12}}>🛏️</Text>
                                        <View style={{flex: 1}}>
                                            <Text style={{fontSize: 17, fontWeight: '700', color: '#111'}}>
                                                {t('insights.pillowcaseNotChanged')}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '600',
                                                color: habitCorrelation.pillowcase.rate >= 60 ? '#dc2626' : '#d97706',
                                                marginTop: 2,
                                            }}>
                                                {habitCorrelation.pillowcase.rate >= 60
                                                    ? t('insights.highRisk')
                                                    : t('insights.mediumRisk')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{
                                        height: 10,
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: 5,
                                        marginBottom: 12,
                                        overflow: 'hidden',
                                    }}>
                                        <View style={{
                                            width: `${habitCorrelation.pillowcase.rate}%`,
                                            height: '100%',
                                            backgroundColor: habitCorrelation.pillowcase.rate >= 60 ? '#ef4444' : '#f59e0b',
                                            borderRadius: 5,
                                        }}/>
                                    </View>

                                    <Text style={{color: '#6b7280', fontSize: 13, marginBottom: 4, lineHeight: 18}}>
                                        {t('insights.pillowcaseDesc1', {
                                            period: viewPeriod === '7d' ? t('insights.recent7days') : t('insights.recent30days'),
                                            count: habitCorrelation.pillowcase.count
                                        })}
                                    </Text>
                                    <Text style={{color: '#6b7280', fontSize: 13, marginBottom: 8, lineHeight: 18}}>
                                        {t('insights.pillowcaseDesc2', {bad: habitCorrelation.pillowcase.badNextDay})}
                                    </Text>

                                    <Text style={{
                                        fontSize: 36,
                                        fontWeight: '800',
                                        color: habitCorrelation.pillowcase.rate >= 60 ? '#dc2626' : '#d97706',
                                        marginBottom: 10,
                                    }}>
                                        {habitCorrelation.pillowcase.rate}%
                                    </Text>

                                    <View style={{
                                        padding: 12,
                                        backgroundColor: habitCorrelation.pillowcase.rate >= 60 ? '#fef2f2' : '#fffbeb',
                                        borderRadius: 8,
                                    }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: habitCorrelation.pillowcase.rate >= 60 ? '#991b1b' : '#92400e',
                                            lineHeight: 20,
                                        }}>
                                            {habitCorrelation.pillowcase.rate >= 60
                                                ? `🚨 ${t('insights.changePillowcase')}`
                                                : `💡 ${t('insights.regularChange')}`
                                            }
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* 스트레스 */}
                            {habitCorrelation.stress.count > 0 && (
                                <View style={{
                                    padding: 16,
                                    marginBottom: 12,
                                    backgroundColor: '#fff',
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: habitCorrelation.stress.rate >= 60 ? '#ef4444' : '#f59e0b',
                                }}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                                        <Text style={{fontSize: 32, marginRight: 12}}>😰</Text>
                                        <View style={{flex: 1}}>
                                            <Text style={{fontSize: 17, fontWeight: '700', color: '#111'}}>
                                                {t('insights.highStress')}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '600',
                                                color: habitCorrelation.stress.rate >= 60 ? '#dc2626' : '#d97706',
                                                marginTop: 2,
                                            }}>
                                                {habitCorrelation.stress.rate >= 60
                                                    ? t('insights.highRisk')
                                                    : t('insights.mediumRisk')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{
                                        height: 10,
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: 5,
                                        marginBottom: 12,
                                        overflow: 'hidden',
                                    }}>
                                        <View style={{
                                            width: `${habitCorrelation.stress.rate}%`,
                                            height: '100%',
                                            backgroundColor: habitCorrelation.stress.rate >= 60 ? '#ef4444' : '#f59e0b',
                                        }}/>
                                    </View>

                                    <Text style={{color: '#6b7280', fontSize: 13, marginBottom: 4, lineHeight: 18}}>
                                        {t('insights.stressDesc1', {
                                            period: viewPeriod === '7d' ? t('insights.recent7days') : t('insights.recent30days'),
                                            count: habitCorrelation.stress.count
                                        })}
                                    </Text>
                                    <Text style={{color: '#6b7280', fontSize: 13, marginBottom: 8, lineHeight: 18}}>
                                        {t('insights.stressDesc2', {bad: habitCorrelation.stress.badNextDay})}
                                    </Text>

                                    <Text style={{
                                        fontSize: 36,
                                        fontWeight: '800',
                                        color: habitCorrelation.stress.rate >= 60 ? '#dc2626' : '#d97706',
                                        marginBottom: 10,
                                    }}>
                                        {habitCorrelation.stress.rate}%
                                    </Text>

                                    <View style={{
                                        padding: 12,
                                        backgroundColor: habitCorrelation.stress.rate >= 60 ? '#fef2f2' : '#fffbeb',
                                        borderRadius: 8,
                                    }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: habitCorrelation.stress.rate >= 60 ? '#991b1b' : '#92400e',
                                            lineHeight: 20,
                                        }}>
                                            🧘 {t('insights.manageStress')}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* 수면 부족 */}
                            {habitCorrelation.sleep && habitCorrelation.sleep.count > 0 && (
                                <View style={{
                                    padding: 16,
                                    marginBottom: 12,
                                    backgroundColor: '#fff',
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: '#f59e0b',
                                }}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                                        <Text style={{fontSize: 32, marginRight: 12}}>😴</Text>
                                        <View style={{flex: 1}}>
                                            <Text style={{fontSize: 17, fontWeight: '700', color: '#111'}}>
                                                {t('insights.poorSleep')}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '600',
                                                color: '#d97706',
                                                marginTop: 2,
                                            }}>
                                                {t('insights.mediumRisk')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{
                                        height: 10,
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: 5,
                                        marginBottom: 12,
                                        overflow: 'hidden',
                                    }}>
                                        <View style={{
                                            width: `${habitCorrelation.sleep.rate}%`,
                                            height: '100%',
                                            backgroundColor: '#f59e0b',
                                        }}/>
                                    </View>

                                    <Text style={{color: '#6b7280', fontSize: 13, marginBottom: 4, lineHeight: 18}}>
                                        {t('insights.sleepDesc1', {
                                            period: viewPeriod === '7d' ? t('insights.recent7days') : t('insights.recent30days'),
                                            count: habitCorrelation.sleep.count,
                                            avgHours: habitCorrelation.sleep.avgHours.toFixed(1)
                                        })}
                                    </Text>
                                    <Text style={{color: '#6b7280', fontSize: 13, marginBottom: 8, lineHeight: 18}}>
                                        {t('insights.sleepDesc2', {bad: habitCorrelation.sleep.badNextDay})}
                                    </Text>

                                    <Text style={{fontSize: 36, fontWeight: '800', color: '#d97706', marginBottom: 10}}>
                                        {habitCorrelation.sleep.rate}%
                                    </Text>

                                    <View style={{
                                        padding: 12,
                                        backgroundColor: '#fffbeb',
                                        borderRadius: 8,
                                    }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: '#92400e',
                                            lineHeight: 20,
                                        }}>
                                            💤 {t('insights.getSleep')}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

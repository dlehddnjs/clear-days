import {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, Text, View} from 'react-native';

import {t} from '../../src/i18n';
import {createExperiment, getActiveExperiments, getExperimentProgress} from '../../src/db/repo';
import {SafeAreaView} from "react-native-safe-area-context";

const PRESET_EXPERIMENTS = [
    {nameKey: 'experiments.presetCarbs', target_food: 'refined_carbs', target_days: 14, max_eat_days: 2, emoji: '🍞'},
    {nameKey: 'experiments.presetDairy', target_food: 'dairy', target_days: 14, max_eat_days: 2, emoji: '🥛'},
    {nameKey: 'experiments.presetAlcohol', target_food: 'alcohol', target_days: 14, max_eat_days: 1, emoji: '🍺'},
    {nameKey: 'experiments.presetHighFat', target_food: 'high_fat', target_days: 14, max_eat_days: 2, emoji: '🍖'},
] as const;

export default function ExperimentsScreen() {
    const [activeExps, setActiveExps] = useState<any[]>([]);

    useEffect(() => {
        loadExperiments();
    }, []);

    const loadExperiments = async () => {
        const exps = await getActiveExperiments();
        const withProgress = await Promise.all(
            exps.map(async (exp) => ({
                ...exp,
                progress: await getExperimentProgress(exp),
            }))
        );
        setActiveExps(withProgress);
    };

    const startPreset = async (preset: (typeof PRESET_EXPERIMENTS)[number]) => {
        const start = new Date().toISOString().slice(0, 10);
        const end = new Date(Date.now() + preset.target_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        await createExperiment({
            name: t(preset.nameKey),
            target_food: preset.target_food,
            target_days: preset.target_days,
            max_eat_days: preset.max_eat_days,
            start_date: start,
            end_date: end,
        });

        Alert.alert(t('experiments.started'), t(preset.nameKey));
        loadExperiments();
    };

    const getDDay = (endDate: string): number => {
        const today = new Date().toISOString().slice(0, 10);
        const end = new Date(endDate);
        const now = new Date(today);
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getStatusColor = (achievement: number) => {
        if (achievement >= 80) return {bg: '#dcfce7', border: '#86efac', text: '#166534'};
        if (achievement >= 50) return {bg: '#fef9c3', border: '#fde047', text: '#854d0e'};
        return {bg: '#fee2e2', border: '#fca5a5', text: '#991b1b'};
    };

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: '#f9fafb'}} edges={['top', 'left', 'right']}>
            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16}}>
                {/* 진행 중 실험 */}
                <View style={{marginBottom: 24}}>
                    <Text style={{fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#111'}}>
                        🔬 {t('experiments.activeTitle')}
                    </Text>

                    {activeExps.length === 0 ? (
                        <View style={{
                            alignItems: 'center',
                            padding: 48,
                            backgroundColor: 'white',
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderStyle: 'dashed'
                        }}>
                            <Text style={{fontSize: 40, marginBottom: 8}}>🧪</Text>
                            <Text style={{color: '#9ca3af', fontSize: 15}}>
                                {t('experiments.noneActive')}
                            </Text>
                        </View>
                    ) : (
                        activeExps.map((exp: any) => {
                            const p = exp.progress;
                            const achievement =
                                exp.max_eat_days > 0
                                    ? Math.round(((exp.max_eat_days - p.currentEatDays) / exp.max_eat_days) * 100)
                                    : 0;
                            const dDay = getDDay(exp.end_date);
                            const statusColor = getStatusColor(achievement);
                            const eatProgress = (p.currentEatDays / exp.max_eat_days) * 100;

                            return (
                                <View
                                    key={exp.id}
                                    style={{
                                        marginBottom: 16,
                                        backgroundColor: 'white',
                                        borderRadius: 16,
                                        borderWidth: 2,
                                        borderColor: statusColor.border,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* 헤더 */}
                                    <View
                                        style={{
                                            backgroundColor: statusColor.bg,
                                            padding: 16,
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text
                                            style={{fontSize: 18, fontWeight: '700', color: statusColor.text, flex: 1}}>
                                            {exp.name}
                                        </Text>
                                        <View
                                            style={{
                                                backgroundColor: 'white',
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 20,
                                            }}
                                        >
                                            <Text style={{fontSize: 13, fontWeight: '700', color: statusColor.text}}>
                                                {dDay > 0 ? t('experiments.dDayLeft', {days: dDay}) : dDay === 0 ? t('experiments.dDay') : t('experiments.completed')}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 바디 */}
                                    <View style={{padding: 16}}>
                                        {/* 달성률 */}
                                        <View style={{marginBottom: 16}}>
                                            <View style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                marginBottom: 8
                                            }}>
                                                <Text style={{fontSize: 14, color: '#6b7280', fontWeight: '600'}}>
                                                    {t('experiments.achievement')}
                                                </Text>
                                                <Text
                                                    style={{fontSize: 18, fontWeight: '800', color: statusColor.text}}>
                                                    {achievement}%
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    height: 8,
                                                    backgroundColor: '#f3f4f6',
                                                    borderRadius: 4,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        height: '100%',
                                                        width: `${Math.min(achievement, 100)}%`,
                                                        backgroundColor: statusColor.text,
                                                    }}
                                                />
                                            </View>
                                        </View>

                                        {/* 섭취 현황 */}
                                        <View style={{marginBottom: 12}}>
                                            <View style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                marginBottom: 8
                                            }}>
                                                <Text style={{fontSize: 14, color: '#6b7280', fontWeight: '600'}}>
                                                    {t('experiments.eatDays')}
                                                </Text>
                                                <Text style={{fontSize: 15, fontWeight: '700', color: '#111'}}>
                                                    {t('experiments.eatDaysValue', {
                                                        current: p.currentEatDays,
                                                        max: exp.max_eat_days
                                                    })}
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    height: 6,
                                                    backgroundColor: '#f3f4f6',
                                                    borderRadius: 3,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        height: '100%',
                                                        width: `${Math.min(eatProgress, 100)}%`,
                                                        backgroundColor: eatProgress > 100 ? '#dc2626' : '#3b82f6',
                                                    }}
                                                />
                                            </View>
                                        </View>

                                        {/* 다음날 악화 */}
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: '#fef3c7',
                                                padding: 12,
                                                borderRadius: 8,
                                                marginBottom: 12,
                                            }}
                                        >
                                            <Text style={{fontSize: 20, marginRight: 8}}>⚠️</Text>
                                            <View style={{flex: 1}}>
                                                <Text style={{fontSize: 13, color: '#92400e', fontWeight: '600'}}>
                                                    {t('experiments.nextDayBad')}
                                                </Text>
                                                <Text style={{fontSize: 16, fontWeight: '700', color: '#92400e'}}>
                                                    {t('experiments.nextDayBadValue', {
                                                        count: p.nextDayBadCount,
                                                        rate: p.nextDayBadRate
                                                    })}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* 기간 */}
                                        <Text style={{fontSize: 12, color: '#9ca3af', textAlign: 'center'}}>
                                            📅 {exp.start_date} ~ {exp.end_date}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* 새 실험 시작 */}
                <View>
                    <Text style={{fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#111'}}>
                        ➕ {t('experiments.startTitle')}
                    </Text>

                    {PRESET_EXPERIMENTS.map((preset, i) => (
                        <Pressable
                            key={i}
                            onPress={() => startPreset(preset)}
                            style={({pressed}) => ({
                                padding: 16,
                                marginBottom: 12,
                                backgroundColor: pressed ? '#f1f5f9' : 'white',
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: '#e2e8f0',
                            })}
                        >
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                                <Text style={{fontSize: 20, marginRight: 8}}>
                                    {preset.emoji}
                                </Text>
                                <Text style={{fontSize: 16, fontWeight: '700', color: '#111', flex: 1}}>
                                    {t(preset.nameKey)}
                                </Text>
                                <Text style={{fontSize: 12, color: '#3b82f6', fontWeight: '700'}}>
                                    {t('experiments.startButton')}
                                </Text>
                            </View>
                            <Text style={{fontSize: 13, color: '#64748b', lineHeight: 18}}>
                                {t('experiments.presetDesc', {days: preset.target_days, max: preset.max_eat_days})}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

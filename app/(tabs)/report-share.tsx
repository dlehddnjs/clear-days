import {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Dimensions, Pressable, ScrollView, Text, View} from 'react-native';
import * as Sharing from 'expo-sharing';
import {captureRef} from 'react-native-view-shot';
import {useLocalSearchParams, useRouter} from 'expo-router';

import {t} from '../../src/i18n';
import {getFoodLagInsights, getWeeklyTrend} from '../../src/db/repo';

const screenWidth = Dimensions.get('window').width;

export default function ReportShareScreen() {
    const router = useRouter();
    const {title} = useLocalSearchParams<{ title?: string }>();
    const shareRef = useRef<View>(null);

    const [loading, setLoading] = useState(true);
    const [weekly, setWeekly] = useState<any[]>([]);
    const [triggers, setTriggers] = useState<Record<string, any>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [w, tgr] = await Promise.all([getWeeklyTrend(28), getFoodLagInsights(14)]);
            setWeekly(w);
            setTriggers(tgr);
        } finally {
            setLoading(false);
        }
    };

    const chartData = useMemo(() => {
        // ... 기존 report.tsx의 lineData/topTriggers 로직 동일 복사
    }, [weekly, triggers]);

    const shareImage = async () => {
        if (!shareRef.current) return;

        try {
            const uri = await captureRef(shareRef.current, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });

            await Sharing.shareAsync(uri, {
                dialogTitle: t('report.share'),
                mimeType: 'image/png',
            });
        } catch (e) {
            Alert.alert(t('report.shareFail'));
        }
    };

    if (loading) {
        return <Text>{t('common.loading')}</Text>;
    }

    return (
        <View style={{flex: 1}}>
            <Pressable onPress={() => router.back()} style={{padding: 12}}>
                <Text>{t('common.close')}</Text>
            </Pressable>

            <ScrollView contentContainerStyle={{padding: 16}}>
                <View ref={shareRef} collapsable={false}>
                    {/* report.tsx의 캡처 영역 JSX 동일 복사 */}
                    <Text style={{fontSize: 20, fontWeight: '700'}}>{title}</Text>
                    {/* 차트들 */}
                </View>
            </ScrollView>

            <Pressable onPress={shareImage}
                       style={{padding: 16, backgroundColor: '#111', margin: 16, borderRadius: 12}}>
                <Text style={{color: 'white', textAlign: 'center', fontWeight: '700'}}>
                    {t('report.share')}
                </Text>
            </Pressable>
        </View>
    );
}

import {useCallback, useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {Calendar, LocaleConfig} from 'react-native-calendars';
import {useFocusEffect, useRouter} from 'expo-router';

import {getCurrentLocale, t} from '../../src/i18n';
import {getDailyLog, listCalendarMarks} from '../../src/db/repo';
import {SafeAreaView} from "react-native-safe-area-context";

const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

LocaleConfig.locales['ko'] = {
    monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
    dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
    today: '오늘'
};

LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today'
};

export default function CalendarScreen() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
    const [currentToday, setCurrentToday] = useState(todayKey());

    const refreshMarks = useCallback(async () => {
        const marks = await listCalendarMarks();
        setMarkedDates(marks);
    }, []);

    const renderCustomHeader = (date: any) => {
        const currentLocale = getCurrentLocale();
        const year = date.getFullYear();
        const month = date.getMonth();

        if (currentLocale === 'ko') {
            return (
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 16,
                }}>
                    <Text style={{fontSize: 20, fontWeight: '800', color: '#111'}}>
                        {year}년 {month + 1}월
                    </Text>
                </View>
            );
        } else {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return (
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 16,
                }}>
                    <Text style={{fontSize: 20, fontWeight: '800', color: '#111'}}>
                        {monthNames[month]} {year}
                    </Text>
                </View>
            );
        }
    };

    useEffect(() => {
        const currentLocale = getCurrentLocale();
        LocaleConfig.defaultLocale = currentLocale;

        refreshMarks().then(() => setReady(true));

        const tKey = todayKey();
        getDailyLog(tKey).then(todayLog => {
            if (!todayLog) {
                router.push(`/modal/daily-checkin?date=${tKey}`);
            }
        });
    }, [router, refreshMarks]);

    useFocusEffect(
        useCallback(() => {
            const newToday = todayKey();
            if (newToday !== currentToday) {
                console.log('🌅 New day detected on focus! Refreshing calendar...');
                setCurrentToday(newToday);
            }
            refreshMarks();
            const currentLocale = getCurrentLocale();
            LocaleConfig.defaultLocale = currentLocale;
        }, [currentToday, refreshMarks])
    );

    if (!ready) {
        return (
            <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb'}}
                          edges={['top', 'left', 'right']}>
                <Text style={{color: '#9ca3af', fontSize: 15}}>{t('common.loading')}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: '#f9fafb'}} edges={['top', 'left', 'right']}>
            <View style={{flex: 1}}>
                {/* ✅ 캘린더 카드 */}
                <View style={{
                    margin: 16,
                    backgroundColor: 'white',
                    borderRadius: 20,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                }}>
                    <Calendar
                        markedDates={markedDates}
                        markingType="period"
                        maxDate={currentToday}
                        onDayPress={(day) => {
                            router.push(`/modal/daily-checkin?date=${day.dateString}`);
                        }}
                        renderHeader={renderCustomHeader}
                        theme={{
                            calendarBackground: 'white',
                            textSectionTitleColor: '#9ca3af',
                            selectedDayBackgroundColor: '#111',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#3b82f6',
                            dayTextColor: '#111',
                            textDisabledColor: '#d1d5db',
                            dotColor: '#3b82f6',
                            selectedDotColor: '#ffffff',
                            arrowColor: '#111',
                            monthTextColor: '#111',
                            textDayFontFamily: 'System',
                            textMonthFontFamily: 'System',
                            textDayHeaderFontFamily: 'System',
                            textDayFontWeight: '600',
                            textMonthFontWeight: '800',
                            textDayHeaderFontWeight: '700',
                            textDayFontSize: 15,
                            textMonthFontSize: 20,
                            textDayHeaderFontSize: 13,
                        }}
                        style={{
                            paddingBottom: 12,
                        }}
                    />
                </View>

                {/* ✅ 범례 */}
                <View style={{
                    marginHorizontal: 16,
                    marginBottom: 12,
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                }}>
                    <Text style={{fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 12}}>
                        📊 {t('calendar.legend')}
                    </Text>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <View style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: '#bae6fd',
                                marginRight: 6,
                            }}/>
                            <Text style={{fontSize: 12, color: '#6b7280', fontWeight: '600'}}>
                                {t('calendar.legendGood')}
                            </Text>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <View style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: '#fef08a',
                                marginRight: 6,
                            }}/>
                            <Text style={{fontSize: 12, color: '#6b7280', fontWeight: '600'}}>
                                {t('calendar.legendMedium')}
                            </Text>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <View style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: '#fecaca',
                                marginRight: 6,
                            }}/>
                            <Text style={{fontSize: 12, color: '#6b7280', fontWeight: '600'}}>
                                {t('calendar.legendBad')}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* ✅ 오늘 기록하기 버튼 */}
            <View style={{marginHorizontal: 16, marginBottom: 16}}>
                <Pressable
                    onPress={() => router.push(`/modal/daily-checkin?date=${currentToday}`)}
                    style={({pressed}) => ({
                        padding: 16,
                        backgroundColor: pressed ? '#1f2937' : '#111',
                        borderRadius: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                    })}
                >
                    <Text style={{fontSize: 18, marginRight: 8}}>✏️</Text>
                    <Text style={{color: 'white', textAlign: 'center', fontWeight: '700', fontSize: 16}}>
                        {t('calendar.todayLog')}
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

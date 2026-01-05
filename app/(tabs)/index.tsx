import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { listCalendarMarks, getDailyLog } from '../../src/db/repo';

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function CalendarScreen() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

    useEffect(() => {
        (async () => {
            const marks = await listCalendarMarks();
            setMarkedDates(marks);
            setReady(true);

            const t = todayKey();
            const todayLog = await getDailyLog(t);
            if (!todayLog) router.push(`/modal/daily-checkin?date=${t}`);
        })();
    }, [router]);

    if (!ready) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text>Loading…</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 12 }}>
            <Calendar
                markedDates={markedDates}
                onDayPress={(day) => router.push(`/modal/daily-checkin?date=${day.dateString}`)}
            />

            <Pressable
                onPress={() => router.push(`/modal/daily-checkin?date=${todayKey()}`)}
                style={{ marginTop: 12, padding: 12, backgroundColor: '#111', borderRadius: 8 }}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>오늘 기록하기</Text>
            </Pressable>
        </View>
    );
}

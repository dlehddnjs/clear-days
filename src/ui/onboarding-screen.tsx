import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ONBOARDING_SLIDES } from '../onboarding/types';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
    const listRef = useRef<FlatList<any>>(null);
    const [index, setIndex] = useState(0);

    const slides = useMemo(() => ONBOARDING_SLIDES, []);

    const complete = async () => {
        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        router.replace('/(tabs)');
    };

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        setIndex(Math.round(x / width));
    };

    const next = () => {
        if (index >= slides.length - 1) return complete();
        listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <FlatList
                ref={listRef}
                data={slides}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollEnd}
                renderItem={({ item }) => (
                    <View style={{ width, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 16, color: '#111' }}>
                            {item.title}
                        </Text>
                        <Text style={{ fontSize: 18, textAlign: 'center', lineHeight: 26, color: '#666' }}>
                            {item.description}
                        </Text>
                    </View>
                )}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                {slides.map((_, i) => (
                    <View
                        key={i}
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: i === index ? '#111' : '#e5e7eb',
                        }}
                    />
                ))}
            </View>

            <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
                <Pressable
                    onPress={complete}
                    style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' }}
                >
                    <Text style={{ textAlign: 'center', color: '#6b7280' }}>건너뛰기</Text>
                </Pressable>

                <Pressable
                    onPress={next}
                    style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#111' }}
                >
                    <Text style={{ textAlign: 'center', color: 'white', fontWeight: '600' }}>
                        {index === slides.length - 1 ? '시작하기' : '다음'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

import {useMemo, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {t} from '../i18n';

type Props = {
    onFinish: () => void | Promise<void>;
};

export default function OnboardingScreen({onFinish}: Props) {
    const slides = useMemo(
        () => [
            {title: t('onboarding.title1'), desc: t('onboarding.desc1')},
            {title: t('onboarding.title2'), desc: t('onboarding.desc2')},
            {title: t('onboarding.title3'), desc: t('onboarding.desc3')},
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t('common.language')]
    );

    const [idx, setIdx] = useState(0);
    const isLast = idx === slides.length - 1;

    return (
        <View style={{flex: 1, padding: 24, justifyContent: 'center'}}>
            <View style={{flex: 1, justifyContent: 'center'}}>
                <View style={{marginBottom: 24}}>
                    <Text style={{fontSize: 26, fontWeight: '800', marginBottom: 12}}>{slides[idx].title}</Text>
                    <Text style={{fontSize: 16, color: '#666', lineHeight: 22}}>{slides[idx].desc}</Text>
                </View>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18}}>
                {slides.map((_, i) => (
                    <View
                        key={i}
                        style={{
                            width: i === idx ? 18 : 8,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: i === idx ? '#111' : '#d1d5db',
                        }}
                    />
                ))}
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
                <Pressable
                    onPress={onFinish}
                    style={{flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb'}}
                >
                    <Text style={{textAlign: 'center', fontWeight: '700'}}>{t('onboarding.skip')}</Text>
                </Pressable>

                {isLast ? (
                    <Pressable onPress={onFinish}
                               style={{flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#111'}}>
                        <Text style={{
                            textAlign: 'center',
                            fontWeight: '800',
                            color: 'white'
                        }}>{t('onboarding.start')}</Text>
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={() => setIdx((v) => Math.min(v + 1, slides.length - 1))}
                        style={{flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#111'}}
                    >
                        <Text style={{
                            textAlign: 'center',
                            fontWeight: '800',
                            color: 'white'
                        }}>{t('onboarding.next')}</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

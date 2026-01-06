import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import OnboardingScreen from '../src/ui/OnboardingScreen';

export default function OnboardingRoute() {
    const finish = async () => {
        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        router.replace('/(tabs)');
    };

    return <OnboardingScreen onFinish={finish} />;
}

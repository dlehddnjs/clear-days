export type OnboardingSlide = {
    title: string;
    description: string;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
    {
        title: '트리거를 찾아보세요',
        description: '매일 30초 기록으로 여드름/모낭염 패턴을 찾습니다.',
    },
    {
        title: '음식 다음날 상관관계',
        description: '어제 먹은 음식군과 오늘 악화를 연결해 보여줍니다.',
    },
    {
        title: '14일 실험으로 검증',
        description: '줄여보기 실험으로 내 트리거를 확실히 확인하세요.',
    },
];

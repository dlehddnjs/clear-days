export type NotificationSettings = {
    enabled: boolean;
    morning: boolean;
    evening: boolean;
    morningHour: number; // 0~23
    eveningHour: number; // 0~23
};

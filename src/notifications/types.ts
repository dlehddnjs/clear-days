export type NotificationMode = 'none' | 'morning' | 'evening' | 'both';

export type NotificationSettings = {
    enabled: boolean;
    mode: NotificationMode;
    morningHour: number;
    morningMinute: number;
    eveningHour: number;
    eveningMinute: number;
};

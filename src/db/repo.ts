import {getDb} from './db';
import AsyncStorage from "@react-native-async-storage/async-storage";

export class DbWriteError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DbWriteError';
    }
}

export type DailyLogRow = {
    date: string; // YYYY-MM-DD
    skin_score: 0 | 1 | 2;
    itch: 0 | 1;
    pain: 0 | 1;
    note: string | null;
};

export type FoodEntryRow = {
    date: string;
    category: string; // refined_carbs ...
    amount: number; // 0~2 (현재는 쓰지 않거나 1로 고정 가능)
};

export type HabitLogRow = {
    date: string;
    pillowcase: 0 | 1;
    sleep_hours: number | null;
    sleep_quality: number | null; // 1-5
    stress_level: 1 | 2 | 3 | 4 | 5; // Changed from 0-2 to 1-5
    exercise: 0 | 1;
    water_intake: number | null; // ml
};


export type Experiment = {
    id: number;
    name: string;
    target_food: string;
    target_days: number;
    max_eat_days: number;
    start_date: string;
    end_date: string;
};

function wrapWriteError(e: unknown): DbWriteError {
    const msg = e instanceof Error ? e.message : String(e);
    return new DbWriteError(msg);
}

/** Daily log */
export async function upsertDailyLog(row: DailyLogRow) {
    try {
        const db = await getDb();
        await db.runAsync(
            `INSERT INTO daily_log (date, skin_score, itch, pain, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         skin_score=excluded.skin_score,
         itch=excluded.itch,
         pain=excluded.pain,
         note=excluded.note`,
            row.date,
            row.skin_score,
            row.itch,
            row.pain,
            row.note
        );
    } catch (e) {
        throw wrapWriteError(e);
    }
}

export async function getDailyLog(date: string): Promise<DailyLogRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<DailyLogRow>(`SELECT * FROM daily_log WHERE date = ?`, date);
    return row ?? null;
}

/** Food */
export async function listFoodsForDate(date: string): Promise<FoodEntryRow[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<FoodEntryRow>(`SELECT * FROM food_entry WHERE date = ?`, date);
    return rows ?? [];
}

export async function replaceFoodsForDate(date: string, categories: string[]) {
    try {
        const db = await getDb();
        await db.withTransactionAsync(async () => {
            await db.runAsync(`DELETE FROM food_entry WHERE date = ?`, date);
            for (const c of categories) {
                await db.runAsync(
                    `INSERT INTO food_entry (date, category, amount) VALUES (?, ?, ?)`,
                    date, c, 1
                );
            }
        });
    } catch (e) {
        throw wrapWriteError(e);
    }
}

/**
 * Food lag insights:
 * - For each food category eaten on day D, check skin_score on day D+1.
 * - "bad" is skin_score==2.
 * 반환:
 * {
 *   refined_carbs: { count, badNextDay, rate, rateNum }
 * }
 */
export async function getFoodLagInsights(days: number = 30): Promise<
    Record<string, { count: number; badNextDay: number; rate: string; rateNum: number }>
> {
    const db = await getDb();

    const rows = await db.getAllAsync<any>(`
    WITH food_days AS (
      SELECT date, category
      FROM food_entry
      WHERE date >= date('now', '-${days} days')
    ),
    next_day_skin AS (
      SELECT
        fd.category as category,
        CASE WHEN dl.skin_score = 2 THEN 1 ELSE 0 END as bad_skin,
        1 as cnt
      FROM food_days fd
      JOIN daily_log dl ON dl.date = date(fd.date, '+1 day')
    )
    SELECT
      category,
      SUM(cnt) as total_days,
      SUM(bad_skin) as bad_days
    FROM next_day_skin
    GROUP BY category
    HAVING total_days >= 2
    ORDER BY bad_days * 1.0 / total_days DESC
  `);

    const out: Record<string, { count: number; badNextDay: number; rate: string; rateNum: number }> = {};
    for (const r of rows ?? []) {
        const total = Number(r.total_days ?? 0);
        const bad = Number(r.bad_days ?? 0);
        const rateNum = total > 0 ? (bad / total) * 100 : 0;
        out[r.category] = {
            count: total,
            badNextDay: bad,
            rateNum,
            rate: `${Math.round(rateNum)}%`,
        };
    }
    return out;
}

/** Habits */
export async function upsertHabitLog(row: HabitLogRow) {
    try {
        const db = await getDb();
        await db.runAsync(
            `INSERT INTO habit_log (date, pillowcase, sleep_hours, sleep_quality, stress_level, exercise, water_intake)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         pillowcase=excluded.pillowcase,
         sleep_hours=excluded.sleep_hours,
         sleep_quality=excluded.sleep_quality,
         stress_level=excluded.stress_level,
         exercise=excluded.exercise,
         water_intake=excluded.water_intake`,
            row.date,
            row.pillowcase,
            row.sleep_hours,
            row.sleep_quality ?? null,
            row.stress_level,
            row.exercise,
            row.water_intake ?? null
        );
    } catch (e) {
        throw wrapWriteError(e);
    }
}

export async function getHabitLog(date: string): Promise<HabitLogRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<HabitLogRow>(`SELECT * FROM habit_log WHERE date = ?`, date);
    return row ?? null;
}

/**
 * Habit insights:
 * factor는 "문자열"을 직접 반환하지 않고, 화면에서 i18n 하는 "키"로 반환한다.
 * factor_key 예:
 * - habit.pillowcase_not_changed
 * - habit.stress_high
 */
export async function getHabitInsights(days: number = 30): Promise<
    Array<{ factor_key: string; count: number; avg_score: number }>
> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`
    SELECT
      'habit.pillowcase_not_changed' as factor_key,
      COUNT(*) as count,
      AVG(dl.skin_score) as avg_score
    FROM habit_log h
    JOIN daily_log dl ON dl.date = h.date
    WHERE h.pillowcase = 0
      AND h.date >= date('now', '-${days} days')

    UNION ALL

    SELECT
      'habit.stress_high' as factor_key,
      COUNT(*) as count,
      AVG(dl.skin_score) as avg_score
    FROM habit_log h
    JOIN daily_log dl ON dl.date = h.date
    WHERE h.stress_level >= 4
      AND h.date >= date('now', '-${days} days')
  `);

    return (rows ?? []).map((r: any) => ({
        factor_key: String(r.factor_key),
        count: Number(r.count ?? 0),
        avg_score: Number(r.avg_score ?? 0),
    }));
}

/** Calendar marks */
export async function listCalendarMarks(): Promise<Record<string, any>> {
    const db = await getDb();

    const daily = await db.getAllAsync<any>(`SELECT date, skin_score FROM daily_log ORDER BY date`);

    const marked: Record<string, any> = {};

    // ✅ 색상 함수
    const getColor = (score: number) => {
        if (score === 0) return {color: '#bae6fd', textColor: '#0369a1'};
        if (score === 1) return {color: '#fef08a', textColor: '#a16207'};
        return {color: '#fecaca', textColor: '#b91c1c'};
    };

    // ✅ 날짜 연속성 체크 함수
    const isConsecutiveDay = (date1: string, date2: string): boolean => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
    };

    // ✅ 모든 날짜를 period로 처리
    for (let i = 0; i < daily.length; i++) {
        const current = daily[i];
        const score = Number(current.skin_score ?? 0);

        const prev = i > 0 ? daily[i - 1] : null;
        const next = i < daily.length - 1 ? daily[i + 1] : null;

        const prevScore = prev ? Number(prev.skin_score ?? 0) : -1;
        const nextScore = next ? Number(next.skin_score ?? 0) : -1;

        // ✅ 연속성 + 색상 체크
        const isPrevConsecutive = prev && isConsecutiveDay(prev.date, current.date);
        const isNextConsecutive = next && isConsecutiveDay(current.date, next.date);

        const canConnectToPrev = isPrevConsecutive && prevScore === score;
        const canConnectToNext = isNextConsecutive && nextScore === score;

        const {color, textColor} = getColor(score);

        marked[current.date] = {
            startingDay: !canConnectToPrev,  // 이전과 연결 안되면 시작
            endingDay: !canConnectToNext,    // 다음과 연결 안되면 끝
            color,
            textColor,
        };
    }

    return marked;
}

/** Experiments */
export async function createExperiment(exp: Omit<Experiment, 'id'>) {
    try {
        const db = await getDb();

        // end_date 보정: endDate를 start_date 기준으로 target_days만큼 +, 날짜만 저장
        const startDate = new Date(exp.start_date + 'T00:00:00');
        const endDate = new Date(startDate.getTime() + exp.target_days * 24 * 60 * 60 * 1000);
        endDate.setHours(23, 59, 59, 999);
        const endKey = endDate.toISOString().slice(0, 10);

        const result = await db.runAsync(
            `INSERT INTO experiment (name, target_food, target_days, max_eat_days, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
            exp.name,
            exp.target_food,
            exp.target_days,
            exp.max_eat_days,
            exp.start_date,
            endKey
        );

        return {id: result.lastInsertRowId!, ...exp, end_date: endKey};
    } catch (e) {
        throw wrapWriteError(e);
    }
}

export async function getActiveExperiments(): Promise<Experiment[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Experiment>(`
    SELECT * FROM experiment
    WHERE date('now') BETWEEN start_date AND end_date
    ORDER BY start_date DESC
  `);
    return rows ?? [];
}

export async function getExperimentProgress(exp: Experiment): Promise<{
    currentEatDays: number;
    totalDays: number;
    nextDayBadCount: number;
    nextDayBadRate: string;
}> {
    const db = await getDb();

    const eatDays = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(DISTINCT date) as count
    FROM food_entry
    WHERE category = ?
      AND date BETWEEN ? AND ?
      AND amount > 0
  `, exp.target_food, exp.start_date, exp.end_date);

    const badDays = await db.getFirstAsync<{ bad_count: number; eat_count: number }>(`
    WITH target_food_days AS (
      SELECT DISTINCT date
      FROM food_entry
      WHERE category = ?
        AND date BETWEEN ? AND date(?, '-1 day')
        AND amount > 0
    )
    SELECT
      COUNT(DISTINCT tfd.date) as eat_count,
      SUM(CASE WHEN dl.skin_score = 2 THEN 1 ELSE 0 END) as bad_count
    FROM target_food_days tfd
    LEFT JOIN daily_log dl ON dl.date = date(tfd.date, '+1 day')
  `, exp.target_food, exp.start_date, exp.end_date);

    const eatCount = Number(badDays?.eat_count ?? 0);
    const badCount = Number(badDays?.bad_count ?? 0);
    const rateNum = eatCount > 0 ? (badCount / eatCount) * 100 : 0;

    return {
        currentEatDays: Number(eatDays?.count ?? 0),
        totalDays: exp.target_days,
        nextDayBadCount: badCount,
        nextDayBadRate: `${Math.round(rateNum)}%`,
    };
}

/** Report */
export async function getWeeklyTrend(days: number): Promise<Array<{ week: string; avgScore: number; count: number }>> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`
    SELECT
      strftime('%Y-W%W', date) as week,
      AVG(skin_score) as avgScore,
      COUNT(*) as count
    FROM daily_log
    WHERE date >= date('now', '-${days} days')
    GROUP BY week
    ORDER BY week DESC
    LIMIT 4
  `);

    return (rows ?? []).map((r: any) => ({
        week: String(r.week),
        avgScore: Number(r.avgScore ?? 0),
        count: Number(r.count ?? 0),
    }));
}

export async function deleteAllData() {
    const db = await getDb();

    await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM daily_log`);
        await db.runAsync(`DELETE FROM food_entry`);
        await db.runAsync(`DELETE FROM habit_log`);
        await db.runAsync(`DELETE FROM experiment`);
    });

    const keys = await AsyncStorage.getAllKeys();
    const keysToDelete = keys.filter(k => k !== 'notificationSettings' && k !== 'locale');
    if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
    }
}

export async function getHabitCorrelation(days = 30) {
    const db = await getDb();

    try {
        // ✅ 해결: 로컬 날짜를 직접 문자열로
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (days - 1));
        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

        console.log(`\n🔍 === Habit Correlation Debug (${days} days) ===`);
        console.log(`📅 Start Date: ${startDateStr}`);
        console.log(`📅 Today: ${todayStr}`);

        // ✅ 전체 habit_log 데이터 확인
        const allHabits = await db.getAllAsync<any>(`
            SELECT date, pillowcase, stress_level, sleep_hours
            FROM habit_log
            WHERE date >= ? AND date <= ?
            ORDER BY date DESC
        `, [startDateStr, todayStr]);

        console.log(`\n📊 Total habit logs in period: ${allHabits?.length || 0}`);
        console.log(`\n🛏️ Pillowcase data:`);
        allHabits?.forEach(h => {
            console.log(`  ${h.date}: pillowcase=${h.pillowcase} (${h.pillowcase === 0 ? 'NOT CHANGED' : 'CHANGED'})`);
        });

        // ✅ 베개커버
        const pillowcaseImpact = await db.getFirstAsync<any>(`
            SELECT 
                COUNT(*) as total_not_changed,
                SUM(CASE WHEN d.skin_score >= 2 THEN 1 ELSE 0 END) as bad_next_day
            FROM habit_log h
            LEFT JOIN daily_log d ON d.date = date(h.date, '+1 day')
            WHERE h.date >= ? AND h.date <= ?
            AND h.pillowcase = 0
        `, [startDateStr, todayStr]);

        console.log(`\n✅ Pillowcase Result: ${pillowcaseImpact?.total_not_changed || 0} days NOT changed`);
        console.log(`   - Bad next day: ${pillowcaseImpact?.bad_next_day || 0}`);

        // ✅ 스트레스
        const stressImpact = await db.getFirstAsync<any>(`
            SELECT 
                COUNT(*) as total_high_stress,
                SUM(CASE WHEN d.skin_score >= 2 THEN 1 ELSE 0 END) as bad_next_day
            FROM habit_log h
            LEFT JOIN daily_log d ON d.date = date(h.date, '+1 day')
            WHERE h.date >= ? AND h.date <= ?
            AND h.stress_level >= 4
        `, [startDateStr, todayStr]);

        console.log(`\n✅ Stress Result: ${stressImpact?.total_high_stress || 0} days HIGH stress`);

        // ✅ 수면 부족
        const sleepImpact = await db.getFirstAsync<any>(`
            SELECT 
                COUNT(*) as total_poor_sleep,
                SUM(CASE WHEN d.skin_score >= 2 THEN 1 ELSE 0 END) as bad_next_day,
                AVG(h.sleep_hours) as avg_hours
            FROM habit_log h
            LEFT JOIN daily_log d ON d.date = date(h.date, '+1 day')
            WHERE h.date >= ? AND h.date <= ?
            AND h.sleep_hours < 7
            AND h.sleep_hours IS NOT NULL
        `, [startDateStr, todayStr]);

        console.log(`\n✅ Sleep Result: ${sleepImpact?.total_poor_sleep || 0} days POOR sleep`);
        console.log(`================================\n`);

        return {
            pillowcase: {
                count: pillowcaseImpact?.total_not_changed || 0,
                badNextDay: pillowcaseImpact?.bad_next_day || 0,
                rate: pillowcaseImpact?.total_not_changed > 0
                    ? Math.round((pillowcaseImpact.bad_next_day / pillowcaseImpact.total_not_changed) * 100)
                    : 0,
            },
            stress: {
                count: stressImpact?.total_high_stress || 0,
                badNextDay: stressImpact?.bad_next_day || 0,
                rate: stressImpact?.total_high_stress > 0
                    ? Math.round((stressImpact.bad_next_day / stressImpact.total_high_stress) * 100)
                    : 0,
            },
            sleep: {
                count: sleepImpact?.total_poor_sleep || 0,
                badNextDay: sleepImpact?.bad_next_day || 0,
                avgHours: sleepImpact?.avg_hours || 0,
                rate: sleepImpact?.total_poor_sleep > 0
                    ? Math.round((sleepImpact.bad_next_day / sleepImpact.total_poor_sleep) * 100)
                    : 0,
            },
        };
    } catch (error) {
        console.error('❌ Error in getHabitCorrelation:', error);
        return {
            pillowcase: {count: 0, badNextDay: 0, rate: 0},
            stress: {count: 0, badNextDay: 0, rate: 0},
            sleep: {count: 0, badNextDay: 0, avgHours: 0, rate: 0},
        };
    }
}


/** Delayed Correlation Analysis */
export type DelayedCorrelationResult = {
    factor: string;
    delayDays: number;
    count: number;
    badSkinCount: number;
    rate: number;
    rateStr: string;
};

export async function getDelayedCorrelation(
    factor: 'stress' | 'sleep_quality' | 'water_intake',
    delayDays: number = 1,
    days: number = 30
): Promise<DelayedCorrelationResult | null> {
    const db = await getDb();
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    let query: string;
    let factorName: string;

    if (factor === 'stress') {
        factorName = 'stress_level';
        query = `
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN dl.skin_score >= 2 THEN 1 ELSE 0 END) as bad_skin_count
            FROM habit_log h
            LEFT JOIN daily_log dl ON dl.date = date(h.date, '+${delayDays} day')
            WHERE h.date >= ? AND h.date <= ?
            AND h.stress_level >= 4
        `;
    } else if (factor === 'sleep_quality') {
        factorName = 'sleep_quality';
        query = `
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN dl.skin_score >= 2 THEN 1 ELSE 0 END) as bad_skin_count
            FROM habit_log h
            LEFT JOIN daily_log dl ON dl.date = date(h.date, '+${delayDays} day')
            WHERE h.date >= ? AND h.date <= ?
            AND h.sleep_quality IS NOT NULL
            AND h.sleep_quality <= 2
        `;
    } else {
        factorName = 'water_intake';
        query = `
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN dl.skin_score >= 2 THEN 1 ELSE 0 END) as bad_skin_count
            FROM habit_log h
            LEFT JOIN daily_log dl ON dl.date = date(h.date, '+${delayDays} day')
            WHERE h.date >= ? AND h.date <= ?
            AND h.water_intake IS NOT NULL
            AND h.water_intake < 1500
        `;
    }

    const result = await db.getFirstAsync<any>(query, [startDateStr, todayStr]);
    
    if (!result || Number(result.total_count) === 0) {
        return null;
    }

    const total = Number(result.total_count);
    const bad = Number(result.bad_skin_count);
    const rate = total > 0 ? (bad / total) * 100 : 0;

    return {
        factor: factorName,
        delayDays,
        count: total,
        badSkinCount: bad,
        rate,
        rateStr: `${Math.round(rate)}%`,
    };
}

export async function getStressDelayedImpact(days: number = 30): Promise<{
    delay1Day: DelayedCorrelationResult | null;
    delay2Days: DelayedCorrelationResult | null;
    delay3Days: DelayedCorrelationResult | null;
}> {
    const [delay1, delay2, delay3] = await Promise.all([
        getDelayedCorrelation('stress', 1, days),
        getDelayedCorrelation('stress', 2, days),
        getDelayedCorrelation('stress', 3, days),
    ]);

    return {
        delay1Day: delay1,
        delay2Days: delay2,
        delay3Days: delay3,
    };
}

export async function getSleepQualityDelayedImpact(days: number = 30): Promise<{
    delay1Day: DelayedCorrelationResult | null;
    delay2Days: DelayedCorrelationResult | null;
}> {
    const [delay1, delay2] = await Promise.all([
        getDelayedCorrelation('sleep_quality', 1, days),
        getDelayedCorrelation('sleep_quality', 2, days),
    ]);

    return {
        delay1Day: delay1,
        delay2Days: delay2,
    };
}

/** Progressive Insights - Data Collection Days */
export async function getDataCollectionDays(): Promise<number> {
    const db = await getDb();
    const firstLog = await db.getFirstAsync<{ date: string }>(
        `SELECT date FROM daily_log ORDER BY date ASC LIMIT 1`
    );
    
    if (!firstLog) return 0;
    
    const firstDate = new Date(firstLog.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - firstDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays;
}

export type InsightAvailability = {
    daysCollected: number;
    canShowBasicInsights: boolean; // 7일 이상
    canShowDetailedInsights: boolean; // 14일 이상
    canShowPersonalizedInsights: boolean; // 30일 이상
    message: string;
};

export async function getInsightAvailability(): Promise<InsightAvailability> {
    const days = await getDataCollectionDays();
    
    return {
        daysCollected: days,
        canShowBasicInsights: days >= 7,
        canShowDetailedInsights: days >= 14,
        canShowPersonalizedInsights: days >= 30,
        message: days < 7 
            ? `Collecting data... (Day ${days})`
            : days < 14
            ? `Basic insights available (${days} days)`
            : days < 30
            ? `Detailed insights available (${days} days)`
            : `Personalized insights available (${days} days)`,
    };
}

/** Auto Detection Algorithms */
export type TriggerDetection = {
    category: string;
    riskLevel: 'high' | 'medium' | 'low';
    impactRate: number;
    count: number;
    badNextDay: number;
    recommendationKey: string;
};

export async function detectTriggers(days: number = 14): Promise<TriggerDetection[]> {
    const insights = await getFoodLagInsights(days);
    const triggers: TriggerDetection[] = [];

    for (const [category, data] of Object.entries(insights)) {
        const rateNum = data.rateNum;
        let riskLevel: 'high' | 'medium' | 'low';
        let recommendationKey: string;

        if (rateNum >= 60) {
            riskLevel = 'high';
            recommendationKey = 'insights.avoidThis';
        } else if (rateNum >= 40) {
            riskLevel = 'medium';
            recommendationKey = 'insights.limitThis';
        } else {
            riskLevel = 'low';
            recommendationKey = 'insights.safeToContinue';
        }

        triggers.push({
            category,
            riskLevel,
            impactRate: rateNum,
            count: data.count,
            badNextDay: data.badNextDay,
            recommendationKey,
        });
    }

    return triggers.sort((a, b) => b.impactRate - a.impactRate);
}

export type PositivePattern = {
    factor: string;
    improvementRate: number;
    count: number;
    descriptionKey: string;
    descriptionParams: Record<string, string | number>;
};

export async function detectPositivePatterns(days: number = 14): Promise<PositivePattern[]> {
    const db = await getDb();
    const patterns: PositivePattern[] = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    // 수면 7시간 이상인 날의 다음날 개선률
    const sleepPattern = await db.getFirstAsync<any>(`
        SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN dl.skin_score <= 1 THEN 1 ELSE 0 END) as good_skin_count
        FROM habit_log h
        LEFT JOIN daily_log dl ON dl.date = date(h.date, '+1 day')
        WHERE h.date >= ? AND h.date <= ?
        AND h.sleep_hours >= 7
        AND h.sleep_hours IS NOT NULL
    `, [startDateStr, todayStr]);

    if (sleepPattern && Number(sleepPattern.total_count) > 0) {
        const total = Number(sleepPattern.total_count);
        const good = Number(sleepPattern.good_skin_count);
        const improvementRate = total > 0 ? (good / total) * 100 : 0;
        
        if (improvementRate >= 50) {
            patterns.push({
                factor: 'sleep_7plus',
                improvementRate,
                count: total,
                descriptionKey: 'insights.personalized.sleepPatternDesc',
                descriptionParams: { rate: Math.round(improvementRate) },
            });
        }
    }

    // 운동한 날의 다음날 개선률
    const exercisePattern = await db.getFirstAsync<any>(`
        SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN dl.skin_score <= 1 THEN 1 ELSE 0 END) as good_skin_count
        FROM habit_log h
        LEFT JOIN daily_log dl ON dl.date = date(h.date, '+1 day')
        WHERE h.date >= ? AND h.date <= ?
        AND h.exercise = 1
    `, [startDateStr, todayStr]);

    if (exercisePattern && Number(exercisePattern.total_count) > 0) {
        const total = Number(exercisePattern.total_count);
        const good = Number(exercisePattern.good_skin_count);
        const improvementRate = total > 0 ? (good / total) * 100 : 0;
        
        if (improvementRate >= 50) {
            patterns.push({
                factor: 'exercise',
                improvementRate,
                count: total,
                descriptionKey: 'insights.personalized.exercisePatternDesc',
                descriptionParams: { rate: Math.round(improvementRate) },
            });
        }
    }

    return patterns;
}


export type StressImpact = {
    stressLevel: number;
    delayDays: number;
    impactRate: number;
    count: number;
    description: string;
};

export async function detectStressImpact(delayDays: number = 2): Promise<StressImpact[]> {
    const result = await getDelayedCorrelation('stress', delayDays, 30);
    if (!result || result.count === 0) return [];
    return [{
        stressLevel: 4,
        delayDays,
        impactRate: result.rate,
        count: result.count,
        description: `High stress (4+) leads to ${Math.round(result.rate)}% skin trouble after ${delayDays} days`,
    }];
}

/** Predictive Alerts */
export type SkinRiskPrediction = {
    date: string;
    riskLevel: 'high' | 'medium' | 'low';
    reasons: string[];
    recommendation: string;
};

export async function predictSkinRisk(date: string): Promise<SkinRiskPrediction | null> {
    const db = await getDb();
    const reasons: string[] = [];
    let riskScore = 0;

    // 최근 14일간의 데이터 분석
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 14);
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    // 고당분 음식 많이 섭취한 주말 체크
    const weekendFoods = await db.getAllAsync<any>(`
        SELECT category, COUNT(*) as count
        FROM food_entry
        WHERE date >= ? AND date < ?
        AND category IN ('refined_carbs', 'fried_fat', 'alcohol')
        GROUP BY category
    `, [startDateStr, date]);

    const highRiskFoods = weekendFoods.filter((f: any) => Number(f.count) >= 3);
    if (highRiskFoods.length > 0) {
        riskScore += 30;
        reasons.push(`High consumption of trigger foods (${highRiskFoods.map((f: any) => f.category).join(', ')})`);
    }

    // 스트레스 레벨 높은 날 체크
    const highStressDays = await db.getAllAsync<any>(`
        SELECT COUNT(*) as count
        FROM habit_log
        WHERE date >= ? AND date < ?
        AND stress_level >= 4
    `, [startDateStr, date]);

    if (Number(highStressDays[0]?.count || 0) >= 3) {
        riskScore += 25;
        reasons.push('Multiple high stress days in the past 2 weeks');
    }

    // 수면 품질 낮은 날 체크
    const poorSleepDays = await db.getAllAsync<any>(`
        SELECT COUNT(*) as count
        FROM habit_log
        WHERE date >= ? AND date < ?
        AND sleep_quality <= 2
    `, [startDateStr, date]);

    if (Number(poorSleepDays[0]?.count || 0) >= 3) {
        riskScore += 20;
        reasons.push('Multiple poor sleep quality days');
    }


    let riskLevel: 'high' | 'medium' | 'low';
    let recommendation: string;

    if (riskScore >= 50) {
        riskLevel = 'high';
        recommendation = 'Pay extra attention to skin care in the next 2-3 days';
    } else if (riskScore >= 30) {
        riskLevel = 'medium';
        recommendation = 'Monitor your skin condition closely';
    } else {
        riskLevel = 'low';
        recommendation = 'Continue your current routine';
    }

    if (reasons.length === 0) {
        return null;
    }

    return {
        date,
        riskLevel,
        reasons,
        recommendation,
    };
}


/** AI-based Personalized Insights */
export type PersonalizedInsight = {
    type: 'comparison' | 'pattern' | 'recommendation';
    titleKey: string;
    descriptionKey: string;
    descriptionParams?: Record<string, string | number>;
    confidence: number; // 0-100
};

export async function getPersonalizedInsights(): Promise<PersonalizedInsight[]> {
    const insights: PersonalizedInsight[] = [];
    const days = await getDataCollectionDays();
    
    if (days < 14) {
        return [{
            type: 'recommendation',
            titleKey: 'insights.personalized.moreDataTitle',
            descriptionKey: 'insights.personalized.moreDataDesc',
            confidence: 0,
        }];
    }

    const db = await getDb();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.min(days, 30));
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    // 스트레스 vs 수면 영향도 비교
    const stressImpact = await getStressDelayedImpact(30);
    const sleepImpact = await getSleepQualityDelayedImpact(30);
    
    const stressRate = stressImpact.delay2Days?.rate || 0;
    const sleepRate = sleepImpact.delay1Day?.rate || 0;

    if (stressRate > 0 || sleepRate > 0) {
        if (sleepRate > stressRate * 1.2) {
            insights.push({
                type: 'comparison',
                titleKey: 'insights.personalized.sleepImpactTitle',
                descriptionKey: 'insights.personalized.sleepImpactDesc',
                confidence: Math.min(80, days * 2),
            });
        } else if (stressRate > sleepRate * 1.2) {
            insights.push({
                type: 'comparison',
                titleKey: 'insights.personalized.stressImpactTitle',
                descriptionKey: 'insights.personalized.stressImpactDesc',
                confidence: Math.min(80, days * 2),
            });
        }
    }


    // 음식 트리거 개인별 순위
    const triggers = await detectTriggers(30);
    if (triggers.length > 0) {
        const topTrigger = triggers[0];
        if (topTrigger.riskLevel === 'high') {
            insights.push({
                type: 'recommendation',
                titleKey: 'insights.personalized.topTriggerTitle',
                descriptionKey: 'insights.personalized.topTriggerDesc',
                descriptionParams: { categoryKey: topTrigger.category, rate: Math.round(topTrigger.impactRate) },
                confidence: Math.min(85, topTrigger.count * 10),
            });
        }
    }

    // 긍정적 패턴
    const positivePatterns = await detectPositivePatterns(30);
    if (positivePatterns.length > 0) {
        const bestPattern = positivePatterns.sort((a, b) => b.improvementRate - a.improvementRate)[0];
        insights.push({
            type: 'pattern',
            titleKey: 'insights.personalized.positivePatternTitle',
            descriptionKey: bestPattern.descriptionKey,
            descriptionParams: bestPattern.descriptionParams,
            confidence: Math.min(75, bestPattern.count * 8),
        });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
}

/** Gamification */
export type Badge = {
    id: string;
    name: string;
    description: string;
    earned: boolean;
    earnedDate: string | null;
};

export async function getBadges(): Promise<Badge[]> {
    const db = await getDb();
    const badges: Badge[] = [];
    
    // 첫 번째 트리거 발견
    const triggers = await detectTriggers(30);
    const hasTrigger = triggers.length > 0 && triggers.some(t => t.riskLevel === 'high');
    badges.push({
        id: 'first_trigger',
        name: 'First Trigger Found',
        description: 'Discovered your first skin trigger',
        earned: hasTrigger,
        earnedDate: hasTrigger ? new Date().toISOString() : null,
    });

    // 7일 연속 입력
    const consecutive7 = await db.getFirstAsync<{ count: number }>(`
        WITH RECURSIVE dates AS (
            SELECT date('now', '-6 days') as date
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < date('now')
        )
        SELECT COUNT(DISTINCT dl.date) as count
        FROM dates d
        JOIN daily_log dl ON dl.date = d.date
    `);
    const has7Days = (consecutive7?.count || 0) >= 7;
    badges.push({
        id: '7_day_streak',
        name: '7 Day Streak',
        description: 'Logged for 7 consecutive days',
        earned: has7Days,
        earnedDate: has7Days ? new Date().toISOString() : null,
    });

    // 30일 연속 입력
    const consecutive30 = await db.getFirstAsync<{ count: number }>(`
        WITH RECURSIVE dates AS (
            SELECT date('now', '-29 days') as date
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < date('now')
        )
        SELECT COUNT(DISTINCT dl.date) as count
        FROM dates d
        JOIN daily_log dl ON dl.date = d.date
    `);
    const has30Days = (consecutive30?.count || 0) >= 30;
    badges.push({
        id: '30_day_streak',
        name: '30 Day Streak',
        description: 'Logged for 30 consecutive days',
        earned: has30Days,
        earnedDate: has30Days ? new Date().toISOString() : null,
    });

    // 첫 번째 긍정적 패턴 발견
    const positivePatterns = await detectPositivePatterns(30);
    const hasPositivePattern = positivePatterns.length > 0;
    badges.push({
        id: 'positive_pattern',
        name: 'Positive Pattern',
        description: 'Discovered a positive lifestyle pattern',
        earned: hasPositivePattern,
        earnedDate: hasPositivePattern ? new Date().toISOString() : null,
    });

    return badges;
}

export async function getConsecutiveDays(): Promise<number> {
    const db = await getDb();

    const rows = await db.getAllAsync<{ date: string }>(
        `SELECT date FROM daily_log WHERE date <= date('now') ORDER BY date DESC LIMIT 400`
    );

    if (!rows || rows.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;

    for (let i = 0; i < rows.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const y = expected.getFullYear();
        const m = String(expected.getMonth() + 1).padStart(2, '0');
        const d = String(expected.getDate()).padStart(2, '0');
        if (rows[i].date !== `${y}-${m}-${d}`) break;
        streak++;
    }

    return streak;
}

/** Early Stage Insights - for users with less than 7 days of data */
export type EarlyStageInsight = {
    type: 'welcome' | 'progress' | 'tip' | 'preview';
    titleKey: string; // i18n key
    descriptionKey: string; // i18n key
    descriptionParams?: Record<string, any>; // for i18n interpolation
    icon: string;
};

export async function getEarlyStageInsights(): Promise<EarlyStageInsight[]> {
    const db = await getDb();
    const insights: EarlyStageInsight[] = [];
    const days = await getDataCollectionDays();
    const consecutiveDays = await getConsecutiveDays();
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 총 기록 개수
    const totalLogs = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM daily_log`);
    const logCount = totalLogs?.count || 0;
    
    // 첫 기록 축하
    if (logCount === 1) {
        insights.push({
            type: 'welcome',
            titleKey: 'insights.earlyStage.firstRecord',
            descriptionKey: 'insights.earlyStage.firstRecordDesc',
            icon: '🎉',
        });
    }
    
    // 진행 상황
    if (days > 0 && days < 7) {
        const remainingDays = 7 - days;
        insights.push({
            type: 'progress',
            titleKey: 'insights.earlyStage.dayTracking',
            descriptionKey: 'insights.earlyStage.dayTrackingDesc',
            descriptionParams: {days, remaining: remainingDays, remainingPlural: remainingDays > 1 ? 's' : ''},
            icon: '📈',
        });
    }
    
    // 연속 기록 유도
    if (consecutiveDays > 0 && consecutiveDays < 7) {
        insights.push({
            type: 'progress',
            titleKey: 'insights.earlyStage.streak',
            descriptionKey: 'insights.earlyStage.streakDesc',
            descriptionParams: {days: consecutiveDays},
            icon: '🔥',
        });
    }
    
    // 초기 팁
    if (days < 3) {
        insights.push({
            type: 'tip',
            titleKey: 'insights.earlyStage.quickTip',
            descriptionKey: 'insights.earlyStage.quickTipDesc',
            icon: '💡',
        });
    } else if (days < 7) {
        insights.push({
            type: 'tip',
            titleKey: 'insights.earlyStage.trackingTip',
            descriptionKey: 'insights.earlyStage.trackingTipDesc',
            icon: '💡',
        });
    }
    
    // 예상 인사이트 미리보기
    if (days >= 3 && days < 7) {
        // 최근 기록된 음식 카테고리 확인
        const recentFoods = await db.getAllAsync<any>(`
            SELECT category, COUNT(*) as count
            FROM food_entry
            WHERE date >= date('now', '-${days} days')
            GROUP BY category
            ORDER BY count DESC
            LIMIT 3
        `);
        
        if (recentFoods && recentFoods.length > 0) {
            insights.push({
                type: 'preview',
                titleKey: 'insights.earlyStage.preview',
                descriptionKey: 'insights.earlyStage.previewDesc',
                icon: '🔍',
            });
        }
    }
    
    // 현재 피부 상태 요약 (있는 경우)
    if (logCount > 0) {
        const recentScores = await db.getAllAsync<any>(`
            SELECT skin_score, COUNT(*) as count
            FROM daily_log
            GROUP BY skin_score
            ORDER BY skin_score
        `);
        
        if (recentScores && recentScores.length > 0) {
            const goodDays = recentScores.find((s: any) => s.skin_score === 0)?.count || 0;
            const total = recentScores.reduce((sum: number, s: any) => sum + Number(s.count), 0);
            const goodRate = total > 0 ? Math.round((goodDays / total) * 100) : 0;
            
            if (goodRate > 0) {
                insights.push({
                    type: 'progress',
                    titleKey: 'insights.earlyStage.progress',
                    descriptionKey: 'insights.earlyStage.progressDesc',
                    descriptionParams: {rate: goodRate},
                    icon: '✨',
                });
            }
        }
    }
    
    return insights;
}






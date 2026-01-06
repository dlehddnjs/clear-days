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
    stress_level: 0 | 1 | 2;
    exercise: 0 | 1;
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

        await db.runAsync(`DELETE FROM food_entry WHERE date = ?`, date);

        for (const c of categories) {
            await db.runAsync(
                `INSERT INTO food_entry (date, category, amount) VALUES (?, ?, ?)`,
                date,
                c,
                1
            );
        }
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
            `INSERT INTO habit_log (date, pillowcase, sleep_hours, stress_level, exercise)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         pillowcase=excluded.pillowcase,
         sleep_hours=excluded.sleep_hours,
         stress_level=excluded.stress_level,
         exercise=excluded.exercise`,
            row.date,
            row.pillowcase,
            row.sleep_hours,
            row.stress_level,
            row.exercise
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
    WHERE h.stress_level = 2
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

    // ✅ 1. SQLite 테이블 전체 삭제
    await db.execAsync(`DELETE FROM daily_log;`);
    await db.execAsync(`DELETE FROM food_entry;`);
    await db.execAsync(`DELETE FROM habit_log;`);
    await db.execAsync(`DELETE FROM experiment;`);

    // ✅ 2. AsyncStorage 전체 삭제 (알림 설정 제외 선택 가능)
    // 옵션 A: 알림 설정 유지
    const keys = await AsyncStorage.getAllKeys();
    const keysToDelete = keys.filter(k => k !== 'notificationSettings' && k !== 'locale');
    if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
    }

    // 옵션 B: 완전 삭제 (주석 해제 시)
    // await AsyncStorage.clear();
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
            AND h.stress_level >= 2
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






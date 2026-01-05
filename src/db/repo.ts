import { getDb } from './db';

export class DbWriteError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DbWriteError';
    }
}

export type DailyLogRow = {
    date: string;
    skin_score: 0 | 1 | 2;
    itch: 0 | 1;
    pain: 0 | 1;
    note: string | null;
};

export type FoodEntry = {
    id: number;
    date: string;
    category: string;
    amount: number;
    time_slot: string | null;
};

export type HabitLog = {
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

function wrapWriteError(e: unknown): never {
    const msg = e instanceof Error ? e.message : String(e);
    throw new DbWriteError(msg);
}

export async function getDailyLog(date: string): Promise<DailyLogRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<DailyLogRow>(
        'SELECT date, skin_score, itch, pain, note FROM daily_log WHERE date = ?',
        [date]
    );
    return row ?? null;
}

export async function upsertDailyLog(row: DailyLogRow) {
    const db = await getDb();
    try {
        await db.runAsync(
            `INSERT INTO daily_log (date, skin_score, itch, pain, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         skin_score=excluded.skin_score,
         itch=excluded.itch,
         pain=excluded.pain,
         note=excluded.note`,
            [row.date, row.skin_score, row.itch, row.pain, row.note]
        );
    } catch (e) {
        wrapWriteError(e);
    }
}

export async function listFoodsForDate(date: string): Promise<Array<Pick<FoodEntry, 'id' | 'category'>>> {
    const db = await getDb();
    const rows = await db.getAllAsync<Pick<FoodEntry, 'id' | 'category'>>(
        'SELECT id, category FROM food_entry WHERE date = ? ORDER BY id ASC',
        [date]
    );
    return rows ?? [];
}

export async function replaceFoodsForDate(date: string, categories: string[]) {
    const db = await getDb();
    try {
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM food_entry WHERE date = ?', [date]);
            for (const c of categories) {
                await db.runAsync(
                    'INSERT INTO food_entry (date, category, amount, time_slot) VALUES (?, ?, 1, NULL)',
                    [date, c]
                );
            }
        });
    } catch (e) {
        wrapWriteError(e);
    }
}

export async function upsertHabitLog(habit: HabitLog) {
    const db = await getDb();
    try {
        await db.runAsync(
            `INSERT INTO habit_log (date, pillowcase, sleep_hours, stress_level, exercise)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         pillowcase=excluded.pillowcase,
         sleep_hours=excluded.sleep_hours,
         stress_level=excluded.stress_level,
         exercise=excluded.exercise`,
            [habit.date, habit.pillowcase, habit.sleep_hours ?? null, habit.stress_level, habit.exercise]
        );
    } catch (e) {
        wrapWriteError(e);
    }
}

export async function getHabitLog(date: string): Promise<HabitLog | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<HabitLog>('SELECT * FROM habit_log WHERE date = ?', [date]);
    return row ?? null;
}

export async function listCalendarMarks(): Promise<Record<string, any>> {
    const db = await getDb();

    const daily = await db.getAllAsync<{ date: string; skin_score: number }>('SELECT date, skin_score FROM daily_log');
    const habits = await db.getAllAsync<{ date: string; pillowcase: number }>('SELECT date, pillowcase FROM habit_log');

    const marked: Record<string, any> = {};

    for (const r of daily ?? []) {
        marked[r.date] = {
            ...(marked[r.date] ?? {}),
            marked: true,
            dotColor: r.skin_score === 2 ? '#e11d48' : r.skin_score === 1 ? '#f59e0b' : '#22c55e',
        };
    }

    // 베개커버 교체 안함(0)이면 날짜 배경을 살짝 표시(사용자가 원하면 이 로직은 반대로 바꿔도 됨)
    for (const h of habits ?? []) {
        if (h.pillowcase === 0) {
            marked[h.date] = {
                ...(marked[h.date] ?? {}),
                customStyles: {
                    container: { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                },
            };
        }
    }

    return marked;
}

export async function getFoodLagInsights(days: number = 30): Promise<
    Record<string, { count: number; badNextDay: number; rate: string; rateNum: number }>
> {
    const db = await getDb();

    const rows = await db.getAllAsync<any>(`
    WITH food_days AS (
      SELECT DISTINCT date, category
      FROM food_entry
      WHERE date >= date('now', '-${days} days')
    ),
    next_day AS (
      SELECT
        fd.category AS category,
        CASE WHEN dl.skin_score = 2 THEN 1 ELSE 0 END AS bad_skin
      FROM food_days fd
      JOIN daily_log dl ON dl.date = date(fd.date, '+1 day')
    )
    SELECT
      category,
      COUNT(*) AS total_days,
      SUM(bad_skin) AS bad_days
    FROM next_day
    GROUP BY category
    HAVING total_days >= 2
    ORDER BY (SUM(bad_skin) * 1.0 / COUNT(*)) DESC
  `);

    const out: Record<string, { count: number; badNextDay: number; rate: string; rateNum: number }> = {};
    for (const r of rows ?? []) {
        const rateNum = r.total_days > 0 ? (r.bad_days / r.total_days) * 100 : 0;
        out[r.category] = {
            count: r.total_days,
            badNextDay: r.bad_days,
            rate: `${rateNum.toFixed(0)}%`,
            rateNum,
        };
    }
    return out;
}

export async function getHabitInsights(days: number = 30): Promise<Array<{ factor: string; count: number; avg_score: number | null }>> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`
    SELECT
      '베개커버 교체 안함' AS factor,
      COUNT(*) AS count,
      AVG(dl.skin_score) AS avg_score
    FROM habit_log h
    JOIN daily_log dl ON dl.date = h.date
    WHERE h.pillowcase = 0
      AND h.date >= date('now', '-${days} days')

    UNION ALL

    SELECT
      '스트레스 높음' AS factor,
      COUNT(*) AS count,
      AVG(dl.skin_score) AS avg_score
    FROM habit_log h
    JOIN daily_log dl ON dl.date = h.date
    WHERE h.stress_level = 2
      AND h.date >= date('now', '-${days} days')
  `);

    return (rows ?? []).map((r: any) => ({
        factor: String(r.factor),
        count: Number(r.count ?? 0),
        avg_score: r.avg_score === null || r.avg_score === undefined ? null : Number(r.avg_score),
    }));
}

export async function createExperiment(exp: Omit<Experiment, 'id'>) {
    const db = await getDb();
    try {
        const result = await db.runAsync(
            `INSERT INTO experiment (name, target_food, target_days, max_eat_days, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [exp.name, exp.target_food, exp.target_days, exp.max_eat_days, exp.start_date, exp.end_date]
        );
        return { id: result.lastInsertRowId as number, ...exp };
    } catch (e) {
        wrapWriteError(e);
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
    SELECT COUNT(DISTINCT date) AS count
    FROM food_entry
    WHERE category = ?
      AND date BETWEEN ? AND ?
      AND amount > 0
  `, [exp.target_food, exp.start_date, exp.end_date]);

    const badDays = await db.getFirstAsync<{ bad_count: number; eat_count: number }>(`
    WITH target_food_days AS (
      SELECT DISTINCT date
      FROM food_entry
      WHERE category = ?
        AND date BETWEEN ? AND date(?, '-1 day')
        AND amount > 0
    )
    SELECT
      COUNT(*) AS eat_count,
      SUM(CASE WHEN dl.skin_score = 2 THEN 1 ELSE 0 END) AS bad_count
    FROM target_food_days tfd
    LEFT JOIN daily_log dl ON dl.date = date(tfd.date, '+1 day')
  `, [exp.target_food, exp.start_date, exp.end_date]);

    const eatCount = Number(badDays?.eat_count ?? 0);
    const badCount = Number(badDays?.bad_count ?? 0);
    const rate = eatCount > 0 ? `${Math.round((badCount / eatCount) * 100)}%` : '0%';

    return {
        currentEatDays: Number(eatDays?.count ?? 0),
        totalDays: exp.target_days,
        nextDayBadCount: badCount,
        nextDayBadRate: rate,
    };
}

export async function getWeeklyTrend(days: number): Promise<Array<{ week: string; avgScore: number; count: number }>> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`
    SELECT
      strftime('%Y-W%W', date) AS week,
      AVG(skin_score) AS avgScore,
      COUNT(*) AS count
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

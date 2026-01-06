import {getDb} from './db';

export async function migrate() {
    const db = await getDb();

    // Daily log
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY NOT NULL,
      skin_score INTEGER NOT NULL,
      itch INTEGER NOT NULL DEFAULT 0,
      pain INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );
  `);

    // Food entry
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS food_entry (
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (date, category)
    );
    CREATE INDEX IF NOT EXISTS idx_food_date ON food_entry(date);
    CREATE INDEX IF NOT EXISTS idx_food_category ON food_entry(category);
  `);

    // Habit log
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habit_log (
      date TEXT PRIMARY KEY NOT NULL,
      pillowcase INTEGER NOT NULL DEFAULT 0,
      sleep_hours REAL,
      stress_level INTEGER NOT NULL DEFAULT 0,
      exercise INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_habit_date ON habit_log(date);
  `);

    // ✅ 기존 테이블에 sleep_hours 컬럼 추가 (없을 경우)
    try {
        // 먼저 컬럼 존재 여부 확인
        const columns = await db.getAllAsync<any>(
            `PRAGMA table_info(habit_log);`
        );

        const hasSleepHours = columns.some((col: any) => col.name === 'sleep_hours');

        if (!hasSleepHours) {
            console.log('Adding sleep_hours column...');
            await db.execAsync(`
                ALTER TABLE habit_log ADD COLUMN sleep_hours REAL;
            `);
            console.log('sleep_hours column added successfully');
        } else {
            console.log('sleep_hours column already exists');
        }
    } catch (e) {
        console.log('Error adding sleep_hours column:', e);
        // 에러 발생 시 무시 (이미 존재하거나 다른 이유)
    }

    // Experiment
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS experiment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_food TEXT NOT NULL,
      target_days INTEGER NOT NULL,
      max_eat_days INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_experiment_range ON experiment(start_date, end_date);
  `);
}

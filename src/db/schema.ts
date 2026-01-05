import { getDb } from './db';

export async function migrate() {
    const db = await getDb();
    await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY,
      skin_score INTEGER NOT NULL, -- 0 없음, 1 조금, 2 많이
      itch INTEGER NOT NULL DEFAULT 0,
      pain INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS food_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1, -- 0 적게, 1 보통, 2 많이
      time_slot TEXT,
      FOREIGN KEY(date) REFERENCES daily_log(date)
    );
    CREATE INDEX IF NOT EXISTS idx_food_entry_date ON food_entry(date);

    CREATE TABLE IF NOT EXISTS habit_log (
      date TEXT PRIMARY KEY,
      pillowcase INTEGER NOT NULL DEFAULT 0,
      sleep_hours REAL,
      stress_level INTEGER NOT NULL DEFAULT 0,
      exercise INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_habit_date ON habit_log(date);

    CREATE TABLE IF NOT EXISTS experiment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_food TEXT NOT NULL,
      target_days INTEGER NOT NULL,
      max_eat_days INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_experiment_dates ON experiment(start_date, end_date);
  `);
}

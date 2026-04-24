import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
    if (!dbPromise) {
        dbPromise = SQLite.openDatabaseAsync('cleardays.db').catch((e) => {
            dbPromise = null;
            throw e;
        });
    }
    return dbPromise;
}

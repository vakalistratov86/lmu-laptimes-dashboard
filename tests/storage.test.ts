import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { tracks, drivers, lapTimes, sessions, sessionResults } from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers: in-memory DB для изолированных тестов
// ---------------------------------------------------------------------------
function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Создаём таблицы
  sqlite.exec(`
    CREATE TABLE tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      length_km REAL NOT NULL DEFAULT 0,
      turns INTEGER NOT NULL DEFAULT 0,
      layout TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      event TEXT NOT NULL DEFAULT '',
      session_type TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      course TEXT,
      track_length_m REAL,
      game_version TEXT,
      date_time TEXT NOT NULL DEFAULT '',
      date_time_unix INTEGER,
      file_name TEXT NOT NULL DEFAULT '',
      setting TEXT,
      driver_count INTEGER NOT NULL DEFAULT 0,
      lap_count INTEGER NOT NULL DEFAULT 0,
      race_laps INTEGER,
      race_time_min INTEGER,
      mech_fail_rate INTEGER,
      damage_mult INTEGER,
      fuel_mult REAL,
      tire_mult REAL,
      vehicles_allowed TEXT,
      parc_ferme INTEGER,
      fixed_setups INTEGER,
      free_settings INTEGER,
      fixed_upgrades INTEGER,
      tire_warmers INTEGER,
      dedicated INTEGER,
      session_duration_min INTEGER,
      session_max_laps INTEGER,
      most_laps_completed INTEGER
    );
    CREATE TABLE lap_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      car_class TEXT NOT NULL DEFAULT '',
      car TEXT NOT NULL DEFAULT '',
      lap_ms INTEGER NOT NULL DEFAULT 0,
      sector1_ms INTEGER NOT NULL DEFAULT 0,
      sector2_ms INTEGER NOT NULL DEFAULT 0,
      sector3_ms INTEGER NOT NULL DEFAULT 0,
      conditions TEXT NOT NULL DEFAULT '',
      tyre TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      session_id INTEGER
    );
    CREATE TABLE session_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      is_player INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      class_position INTEGER NOT NULL DEFAULT 0,
      lap_rank_including_discos INTEGER,
      car_class TEXT NOT NULL DEFAULT '',
      car TEXT NOT NULL DEFAULT '',
      car_type TEXT,
      team TEXT NOT NULL DEFAULT '',
      car_number TEXT,
      veh_file TEXT,
      veh_name TEXT,
      category TEXT,
      laps INTEGER NOT NULL DEFAULT 0,
      pitstops INTEGER NOT NULL DEFAULT 0,
      best_lap_ms INTEGER,
      finish_status TEXT,
      control_and_aids TEXT,
      connected INTEGER
    );
  `);
  return drizzle(sqlite);
}

describe('getLaps() — sessionCourse via JOIN', () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
  });

  it('возвращает sessionCourse=null для круга без привязки к сессии (sessionId=null)', async () => {
    // Вставляем трассу и пилота
    const track = testDb.insert(tracks).values({ name: 'Le Mans', country: 'FR', lengthKm: 13.6, turns: 38, layout: 'Full' }).returning().get();
    const driver = testDb.insert(drivers).values({ name: 'Test Driver', team: 'Team A', country: 'XX' }).returning().get();

    // Круг без привязки к сессии (sessionId = null)
    testDb.insert(lapTimes).values({
      trackId: track.id,
      driverId: driver.id,
      carClass: 'Hypercar',
      car: 'Toyota GR010',
      lapMs: 204000,
      sector1Ms: 67000,
      sector2Ms: 69000,
      sector3Ms: 68000,
      conditions: 'Сухо',
      tyre: 'Medium',
      date: '2026-07-15',
      sessionId: null,
    }).run();

    // JOIN через raw select
    const { eq } = await import('drizzle-orm');
    const rows = testDb
      .select({ lap: lapTimes, sessionCourse: sessions.course })
      .from(lapTimes)
      .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].sessionCourse).toBeNull();
  });

  it('возвращает sessionCourse из сессии для import-кругов', async () => {
    const { eq } = await import('drizzle-orm');

    const track = testDb.insert(tracks).values({ name: 'Spa', country: 'BE', lengthKm: 7.0, turns: 19, layout: 'GP' }).returning().get();
    const driver = testDb.insert(drivers).values({ name: 'Driver B', team: 'Team B', country: 'IT' }).returning().get();

    // Сессия с course = 'Full Course'
    const session = testDb.insert(sessions).values({
      trackId: track.id,
      event: 'Test Race',
      sessionType: 'Race',
      venue: 'Spa',
      course: 'Full Course',
      dateTime: '2026-07-14T15:00:00.000Z',
      fileName: 'test.xml',
      driverCount: 1,
      lapCount: 0,
    }).returning().get();

    testDb.insert(lapTimes).values({
      trackId: track.id,
      driverId: driver.id,
      carClass: 'GT3',
      car: 'Porsche 911 GT3 R',
      lapMs: 135000,
      sector1Ms: 44000,
      sector2Ms: 46000,
      sector3Ms: 45000,
      conditions: 'Сухо',
      tyre: 'Medium',
      date: '2026-07-14',
      sessionId: session.id,
    }).run();

    const rows = testDb
      .select({ lap: lapTimes, sessionCourse: sessions.course })
      .from(lapTimes)
      .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].sessionCourse).toBe('Full Course');
  });

  it('смешанный сценарий: круги с привязкой к сессии и без неё в одном наборе', async () => {
    const { eq } = await import('drizzle-orm');

    const track = testDb.insert(tracks).values({ name: 'Monza', country: 'IT', lengthKm: 5.8, turns: 11, layout: 'GP' }).returning().get();
    const driver = testDb.insert(drivers).values({ name: 'Driver C', team: 'Team C', country: 'DE' }).returning().get();

    const session = testDb.insert(sessions).values({
      trackId: track.id,
      event: 'Monza Race',
      sessionType: 'Race',
      venue: 'Monza',
      course: 'Short Course',
      dateTime: '2026-06-01T12:00:00.000Z',
      fileName: 'monza.xml',
      driverCount: 1,
      lapCount: 0,
    }).returning().get();

    // Круг без привязки к сессии
    testDb.insert(lapTimes).values({
      trackId: track.id, driverId: driver.id, carClass: 'GT3', car: 'Ferrari 488',
      lapMs: 94000, sector1Ms: 31000, sector2Ms: 32000, sector3Ms: 31000,
      conditions: 'Сухо', tyre: 'Soft', date: '2026-05-01', sessionId: null,
    }).run();

    // Круг, привязанный к сессии
    testDb.insert(lapTimes).values({
      trackId: track.id, driverId: driver.id, carClass: 'GT3', car: 'Ferrari 488',
      lapMs: 95000, sector1Ms: 31500, sector2Ms: 32000, sector3Ms: 31500,
      conditions: 'Сухо', tyre: 'Medium', date: '2026-06-01', sessionId: session.id,
    }).run();

    const rows = testDb
      .select({ lap: lapTimes, sessionCourse: sessions.course })
      .from(lapTimes)
      .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
      .all();

    expect(rows).toHaveLength(2);
    const noSessionCourse = rows.find((r) => r.lap.sessionId == null)?.sessionCourse;
    const withSessionCourse = rows.find((r) => r.lap.sessionId != null)?.sessionCourse;
    expect(noSessionCourse).toBeNull();
    expect(withSessionCourse).toBe('Short Course');
  });

  it('разные сессии с разными course правильно сопоставляются', async () => {
    const { eq } = await import('drizzle-orm');

    const track = testDb.insert(tracks).values({ name: 'Le Mans', country: 'FR', lengthKm: 13.6, turns: 38, layout: 'Full' }).returning().get();
    const driver = testDb.insert(drivers).values({ name: 'Driver D', team: 'Team D', country: 'JP' }).returning().get();

    const sessA = testDb.insert(sessions).values({
      trackId: track.id, event: 'Race A', sessionType: 'Race', venue: 'Le Mans',
      course: 'Full 24h', dateTime: '2026-06-10T10:00:00.000Z',
      fileName: 'a.xml', driverCount: 1, lapCount: 0,
    }).returning().get();

    const sessB = testDb.insert(sessions).values({
      trackId: track.id, event: 'Race B', sessionType: 'Race', venue: 'Le Mans',
      course: 'Bugatti', dateTime: '2026-06-11T10:00:00.000Z',
      fileName: 'b.xml', driverCount: 1, lapCount: 0,
    }).returning().get();

    testDb.insert(lapTimes).values({
      trackId: track.id, driverId: driver.id, carClass: 'Hypercar', car: 'Toyota GR010',
      lapMs: 204000, sector1Ms: 67000, sector2Ms: 69000, sector3Ms: 68000,
      conditions: 'Сухо', tyre: 'Hard', date: '2026-06-10', sessionId: sessA.id,
    }).run();

    testDb.insert(lapTimes).values({
      trackId: track.id, driverId: driver.id, carClass: 'Hypercar', car: 'Toyota GR010',
      lapMs: 100000, sector1Ms: 33000, sector2Ms: 34000, sector3Ms: 33000,
      conditions: 'Сухо', tyre: 'Soft', date: '2026-06-11', sessionId: sessB.id,
    }).run();

    const rows = testDb
      .select({ lap: lapTimes, sessionCourse: sessions.course })
      .from(lapTimes)
      .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
      .all();

    expect(rows).toHaveLength(2);
    const courseA = rows.find((r) => r.lap.sessionId === sessA.id)?.sessionCourse;
    const courseB = rows.find((r) => r.lap.sessionId === sessB.id)?.sessionCourse;
    expect(courseA).toBe('Full 24h');
    expect(courseB).toBe('Bugatti');
  });
});

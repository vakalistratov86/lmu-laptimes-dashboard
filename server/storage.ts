import {
  tracks, drivers, lapTimes, sessions, sessionResults, sessionIncidents, sessionTrackLimits,
} from '@shared/schema';
import type {
  Track, InsertTrack,
  Driver,
  DriverEnriched,
  LapTimeEnriched,
  Session, SessionEnriched, SessionResult,
  DriverIncidentsResponse,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, or, desc, inArray } from "drizzle-orm";

const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql);

export interface LapFilter {
  trackId?: number;
  driverId?: number;
  carClass?: string;
  conditions?: string;
  sessionId?: number;
  sessionCourse?: string;
}

export interface ImportResult {
  fileName: string;
  ok: boolean;
  message: string;
  sessionId?: number;
  event?: string;
  venue?: string;
  course?: string | null;
  laps?: number;
  drivers?: number;
}

export interface IStorage {
  getTracks(): Promise<Track[]>;
  getTrack(id: number): Promise<Track | undefined>;
  getDrivers(): Promise<DriverEnriched[]>;
  getDriver(id: number): Promise<Driver | undefined>;
  getDriverIncidents(driverId: number): Promise<DriverIncidentsResponse>;
  getLaps(filter?: LapFilter): Promise<LapTimeEnriched[]>;
  getSessions(): Promise<SessionEnriched[]>;
  getSession(id: number): Promise<SessionEnriched | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getTracks(): Promise<Track[]> {
    return await db.select().from(tracks);
  }

  async getTrack(id: number): Promise<Track | undefined> {
    const rows = await db.select().from(tracks).where(eq(tracks.id, id));
    return rows[0];
  }

  async getDrivers(): Promise<DriverEnriched[]> {
    const allDrivers = await db.select().from(drivers);
    const srRows = await db.select().from(sessionResults);

    const playerMap = new Map<number, number>();
    for (const sr of srRows) {
      const current = playerMap.get(sr.driverId) ?? 0;
      if (sr.isPlayer > current) playerMap.set(sr.driverId, sr.isPlayer);
    }

    return allDrivers.map((d) => ({
      ...d,
      isPlayer: playerMap.has(d.id) ? (playerMap.get(d.id) ?? 0) : null,
    }));
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const rows = await db.select().from(drivers).where(eq(drivers.id, id));
    return rows[0];
  }

  /**
   * Инциденты и нарушения трек-лимитов конкретного пилота по всем сессиям —
   * для страницы профиля пилота. Ни та, ни другая таблица нигде больше не
   * читается на клиенте (только записываются при импорте), это первая точка
   * входа, поэтому обогащение (трасса/дата/имя второго участника) выполняется
   * здесь, а не переиспользуется из другого места.
   *
   * Инциденты выбираются по driver_id (виновник) ИЛИ target_driver_id
   * (пострадавший) — иначе пилот, в которого просто врезались, никогда не
   * увидел бы это в своём профиле. role/otherDriverName ниже нормализуют
   * запись к точке зрения запрошенного пилота.
   */
  async getDriverIncidents(driverId: number): Promise<DriverIncidentsResponse> {
    const [incRows, tlRows] = await Promise.all([
      db.select().from(sessionIncidents).where(
        or(eq(sessionIncidents.driverId, driverId), eq(sessionIncidents.targetDriverId, driverId)),
      ),
      db.select().from(sessionTrackLimits).where(eq(sessionTrackLimits.driverId, driverId)),
    ]);

    const sessionIds = Array.from(new Set([
      ...incRows.map((r) => r.sessionId),
      ...tlRows.map((r) => r.sessionId),
    ]));

    const [sessionRows, trackRows, driverRows] = await Promise.all([
      sessionIds.length ? db.select().from(sessions).where(inArray(sessions.id, sessionIds)) : Promise.resolve([]),
      db.select().from(tracks),
      db.select().from(drivers),
    ]);

    const sessionMap = new Map(sessionRows.map((s) => [s.id, s]));
    const trackMap = new Map(trackRows.map((t) => [t.id, t]));
    const driverMap = new Map(driverRows.map((d) => [d.id, d]));

    const trackNameFor = (sessionId: number): string => {
      const s = sessionMap.get(sessionId);
      if (!s) return "—";
      return trackMap.get(s.trackId)?.name ?? s.venue;
    };
    const dateTimeFor = (sessionId: number): string => sessionMap.get(sessionId)?.dateTime ?? "";

    const incidents = incRows
      .map((r) => {
        const isAtFault = r.driverId === driverId;
        const otherId = isAtFault ? r.targetDriverId : r.driverId;
        return {
          ...r,
          trackName: trackNameFor(r.sessionId),
          dateTime: dateTimeFor(r.sessionId),
          role: (isAtFault ? "caused" : "received") as "caused" | "received",
          otherDriverName: otherId != null ? (driverMap.get(otherId)?.name ?? null) : null,
        };
      })
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime));

    const trackLimits = tlRows
      .map((r) => ({
        ...r,
        trackName: trackNameFor(r.sessionId),
        dateTime: dateTimeFor(r.sessionId),
      }))
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime));

    return { incidents, trackLimits };
  }

  /**
   * #120: раньше грузила tracks/drivers/sessionResults целиком в память на
   * КАЖДЫЙ вызов, независимо от фильтра. Теперь обогащение (трасса, пилот,
   * его команда, isPlayer из session_results для этой же пары session+driver)
   * делается через JOIN в самом SQL-запросе — Postgres фильтрует и джойнит,
   * а не приложение вручную по Map после выгрузки всего датасета.
   */
  async getLaps(filter: LapFilter = {}): Promise<LapTimeEnriched[]> {
    const conditions = [];
    if (filter.trackId != null) conditions.push(eq(lapTimes.trackId, filter.trackId));
    if (filter.driverId != null) conditions.push(eq(lapTimes.driverId, filter.driverId));
    if (filter.carClass) conditions.push(eq(lapTimes.carClass, filter.carClass));
    if (filter.conditions) conditions.push(eq(lapTimes.conditions, filter.conditions));
    if (filter.sessionId != null) conditions.push(eq(lapTimes.sessionId, filter.sessionId));
    if (filter.sessionCourse) conditions.push(eq(sessions.course, filter.sessionCourse));

    const selection = {
      lap: lapTimes,
      sessionCourse: sessions.course,
      trackName: tracks.name,
      driverName: drivers.name,
      driverTeam: drivers.team,
      isPlayer: sessionResults.isPlayer,
    };
    // Join sessionResults по паре (sessionId, driverId) — тот же результат
    // пилота, что относится к сессии этого конкретного круга.
    const sessionResultsJoin = and(
      eq(sessionResults.sessionId, lapTimes.sessionId),
      eq(sessionResults.driverId, lapTimes.driverId),
    );

    const rows = conditions.length
      ? await db
          .select(selection)
          .from(lapTimes)
          .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
          .leftJoin(tracks, eq(lapTimes.trackId, tracks.id))
          .leftJoin(drivers, eq(lapTimes.driverId, drivers.id))
          .leftJoin(sessionResults, sessionResultsJoin)
          .where(and(...conditions))
      : await db
          .select(selection)
          .from(lapTimes)
          .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
          .leftJoin(tracks, eq(lapTimes.trackId, tracks.id))
          .leftJoin(drivers, eq(lapTimes.driverId, drivers.id))
          .leftJoin(sessionResults, sessionResultsJoin);

    return rows.map(({ lap, sessionCourse, trackName, driverName, driverTeam, isPlayer }) => ({
      ...lap,
      trackName: trackName ?? "—",
      driverName: driverName ?? "—",
      team: driverTeam ?? "—",
      isPlayer: isPlayer ?? null,
      sessionCourse: sessionCourse ?? null,
    } satisfies LapTimeEnriched));
  }

  /**
   * #119: раньше enrichSession() делала 3 запроса НА КАЖДУЮ сессию (включая
   * полный скан всей таблицы drivers), т.е. 1 + 3N запросов на getSessions().
   * Теперь трасса джойнится прямо в запросе сессий, а результаты + имена
   * пилотов всех сессий разом одним запросом и группируются в памяти —
   * итого 2 запроса независимо от количества сессий.
   */
  async getSessions(): Promise<SessionEnriched[]> {
    const sessionRows = await db
      .select({ session: sessions, trackName: tracks.name })
      .from(sessions)
      .leftJoin(tracks, eq(sessions.trackId, tracks.id))
      .orderBy(desc(sessions.dateTime));

    return this.attachSessionResults(sessionRows);
  }

  async getSession(id: number): Promise<SessionEnriched | undefined> {
    const sessionRows = await db
      .select({ session: sessions, trackName: tracks.name })
      .from(sessions)
      .leftJoin(tracks, eq(sessions.trackId, tracks.id))
      .where(eq(sessions.id, id));

    const [enriched] = await this.attachSessionResults(sessionRows);
    return enriched;
  }

  private async attachSessionResults(
    sessionRows: { session: Session; trackName: string | null }[],
  ): Promise<SessionEnriched[]> {
    if (sessionRows.length === 0) return [];

    const sessionIds = sessionRows.map((r) => r.session.id);
    const resultRows = await db
      .select({ result: sessionResults, driverName: drivers.name })
      .from(sessionResults)
      .leftJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .where(inArray(sessionResults.sessionId, sessionIds));

    const resultsBySession = new Map<
      number,
      Array<SessionResult & { driverName: string; teamName: string | null }>
    >();
    for (const { result, driverName } of resultRows) {
      const list = resultsBySession.get(result.sessionId) ?? [];
      list.push({
        ...result,
        driverName: driverName ?? "—",
        // Нормализация: гарантируем что teamName не пустая строка
        teamName: result.team && result.team !== "—" ? result.team : null,
      });
      resultsBySession.set(result.sessionId, list);
    }

    return sessionRows.map(({ session, trackName }) => ({
      ...session,
      trackName: trackName ?? session.venue,
      results: (resultsBySession.get(session.id) ?? []).sort((a, b) => a.position - b.position),
    }));
  }
}

export const storage = new DatabaseStorage();

/**
 * Полный каталог трасс LMU, для которых в приложении есть готовая схема
 * (client/src/components/TrackMap.tsx). Имена совпадают с ключами в TrackMap,
 * чтобы схема трассы отображалась независимо от того, есть ли по трассе
 * реальные заезды.
 */
const CATALOG_TRACKS: InsertTrack[] = [
  { name: "Le Mans", country: "Франция", lengthKm: 13.626, turns: 38, layout: "Circuit de la Sarthe" },
  { name: "Spa-Francorchamps", country: "Бельгия", lengthKm: 7.004, turns: 20, layout: "GP" },
  { name: "Monza", country: "Италия", lengthKm: 5.793, turns: 11, layout: "GP" },
  { name: "Fuji Speedway", country: "Япония", lengthKm: 4.563, turns: 16, layout: "GP" },
  { name: "Sebring", country: "США", lengthKm: 6.019, turns: 17, layout: "International" },
  { name: "Bahrain", country: "Бахрейн", lengthKm: 5.412, turns: 15, layout: "GP" },
  // Отдельная физическая конфигурация той же трассы (тот же "name", как и
  // при реальном импорте — см. findOrCreateTrack() в importWorker.ts), она
  // же "короткая" — резолвится в отдельную схему через resolveTrackMapName()
  // (TrackMap.tsx) по подстроке "outer" в layout.
  { name: "Bahrain", country: "Бахрейн", lengthKm: 3.543, turns: 11, layout: "Outer Circuit" },
  { name: "Imola", country: "Италия", lengthKm: 4.909, turns: 19, layout: "GP" },
  { name: "Portimão", country: "Португалия", lengthKm: 4.653, turns: 15, layout: "GP" },
  { name: "Interlagos", country: "Бразилия", lengthKm: 4.309, turns: 15, layout: "GP" },
  { name: "COTA", country: "США", lengthKm: 5.513, turns: 20, layout: "GP" },
  { name: "Silverstone", country: "Великобритания", lengthKm: 5.891, turns: 18, layout: "GP" },
  { name: "Barcelona", country: "Испания", lengthKm: 4.657, turns: 14, layout: "GP" },
  { name: "Paul Ricard", country: "Франция", lengthKm: 5.842, turns: 15, layout: "GP" },
  { name: "Lusail", country: "Катар", lengthKm: 5.380, turns: 16, layout: "GP" },
];

// Тот же допуск, что и TRACK_LENGTH_MATCH_TOLERANCE_KM в importWorker.ts —
// одна физическая трасса считается той же, если длина отличается меньше,
// чем на эту величину; разные реальные конфигурации (напр. Bahrain GP 5.4км
// и Bahrain Outer Circuit 3.5км) отличаются на километры, далеко за порогом.
const CATALOG_LENGTH_MATCH_TOLERANCE_KM = 0.05;

/**
 * Гарантирует, что все трассы каталога присутствуют в БД — даже если по ним
 * ещё не было ни одной сессии/заезда. Идемпотентна: при повторных запусках
 * добавляет только реально отсутствующие строки. Выполняется при каждом
 * старте сервера (в отличие от seedIfEmpty, которая работает один раз на
 * пустой БД).
 *
 * Сравнение по имени И длине трассы (а не только по имени) — иначе каталог
 * не смог бы содержать две разные физические конфигурации одной трассы
 * (напр. Bahrain GP и Bahrain Outer Circuit): вторая запись с тем же
 * названием считалась бы дублем первой и никогда не вставлялась.
 */
export async function ensureCatalogTracks() {
  const existing = await db.select().from(tracks);

  const missing = CATALOG_TRACKS.filter((catalogTrack) => {
    const sameName = existing.filter((t) => t.name.toLowerCase() === catalogTrack.name.toLowerCase());
    return !sameName.some(
      (t) => Math.abs(t.lengthKm - catalogTrack.lengthKm) < CATALOG_LENGTH_MATCH_TOLERANCE_KM,
    );
  });
  if (missing.length === 0) return;

  await db.insert(tracks).values(missing);
}

import {
  tracks, drivers, lapTimes, sessions, sessionResults,
  sessionLaps, sessionIncidents, sessionSectorBests, sessionTrackLimits,
} from '@shared/schema';
import type {
  Track, InsertTrack,
  Driver, InsertDriver,
  DriverEnriched,
  LapTime, InsertLapTime,
  LapTimeEnriched,
  Session, SessionResult, SessionEnriched,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface LapFilter {
  trackId?: number;
  driverId?: number;
  carClass?: string;
  conditions?: string;
  source?: string;
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
  getLaps(filter?: LapFilter): Promise<LapTimeEnriched[]>;
  getSessions(): Promise<SessionEnriched[]>;
  getSession(id: number): Promise<SessionEnriched | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getTracks(): Promise<Track[]> {
    return db.select().from(tracks).all();
  }
  async getTrack(id: number): Promise<Track | undefined> {
    return db.select().from(tracks).where(eq(tracks.id, id)).get();
  }
  async getDrivers(): Promise<DriverEnriched[]> {
    const allDrivers = db.select().from(drivers).all();
    const srRows = db.select().from(sessionResults).all();

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
    return db.select().from(drivers).where(eq(drivers.id, id)).get();
  }
  async getLaps(filter: LapFilter = {}): Promise<LapTimeEnriched[]> {
    const conditions = [];
    if (filter.trackId) conditions.push(eq(lapTimes.trackId, filter.trackId));
    if (filter.driverId) conditions.push(eq(lapTimes.driverId, filter.driverId));
    if (filter.carClass) conditions.push(eq(lapTimes.carClass, filter.carClass));
    if (filter.conditions) conditions.push(eq(lapTimes.conditions, filter.conditions));
    if (filter.source) conditions.push(eq(lapTimes.source, filter.source));
    if (filter.sessionId) conditions.push(eq(lapTimes.sessionId, filter.sessionId));
    if (filter.sessionCourse) conditions.push(eq(sessions.course, filter.sessionCourse));

    const rows = conditions.length
      ? db
          .select({ lap: lapTimes, sessionCourse: sessions.course })
          .from(lapTimes)
          .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
          .where(and(...conditions))
          .all()
      : db
          .select({ lap: lapTimes, sessionCourse: sessions.course })
          .from(lapTimes)
          .leftJoin(sessions, eq(lapTimes.sessionId, sessions.id))
          .all();

    const trackMap = new Map(db.select().from(tracks).all().map((t) => [t.id, t]));
    const driverMap = new Map(db.select().from(drivers).all().map((d) => [d.id, d]));

    const srRows = db.select().from(sessionResults).all();
    const isPlayerMap = new Map<string, number>();
    for (const sr of srRows) {
      isPlayerMap.set(`${sr.sessionId}:${sr.driverId}`, sr.isPlayer);
    }

    return rows.map(({ lap: r, sessionCourse }) => {
      const isPlayer = r.sessionId != null
        ? (isPlayerMap.get(`${r.sessionId}:${r.driverId}`) ?? null)
        : null;
      return {
        ...r,
        trackName: trackMap.get(r.trackId)?.name ?? "—",
        driverName: driverMap.get(r.driverId)?.name ?? "—",
        team: driverMap.get(r.driverId)?.team ?? "—",
        isPlayer,
        sessionCourse: sessionCourse ?? null,
      } satisfies LapTimeEnriched;
    });
  }

  async getSessions(): Promise<SessionEnriched[]> {
    const rows = db.select().from(sessions).orderBy(desc(sessions.dateTime)).all();
    return rows.map((s) => this.enrichSession(s));
  }

  async getSession(id: number): Promise<SessionEnriched | undefined> {
    const s = db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!s) return undefined;
    return this.enrichSession(s);
  }

  private enrichSession(s: Session): SessionEnriched {
    const track = db.select().from(tracks).where(eq(tracks.id, s.trackId)).get();
    const results = db.select().from(sessionResults).where(eq(sessionResults.sessionId, s.id)).all();
    const driverMap = new Map(db.select().from(drivers).all().map((d) => [d.id, d]));
    return {
      ...s,
      trackName: track?.name ?? s.venue,
      results: results
        .map((r) => ({ ...r, driverName: driverMap.get(r.driverId)?.name ?? "—" }))
        .sort((a, b) => a.position - b.position),
    };
  }
}

export const storage = new DatabaseStorage();

// ---- Seeding ----
export function seedIfEmpty() {
  const existing = db.select().from(tracks).all();
  if (existing.length > 0) return;

  const trackData: InsertTrack[] = [
    { name: "Le Mans", country: "Франция", lengthKm: 13.626, turns: 38, layout: "Full 24h" },
    { name: "Spa-Francorchamps", country: "Бельгия", lengthKm: 7.004, turns: 20, layout: "GP" },
    { name: "Monza", country: "Италия", lengthKm: 5.793, turns: 11, layout: "GP" },
    { name: "Fuji Speedway", country: "Япония", lengthKm: 4.563, turns: 16, layout: "GP" },
    { name: "Sebring", country: "США", lengthKm: 6.019, turns: 17, layout: "International" },
    { name: "Bahrain", country: "Бахрейн", lengthKm: 5.412, turns: 15, layout: "GP" },
    { name: "Imola", country: "Италия", lengthKm: 4.909, turns: 19, layout: "GP" },
    { name: "Portimão", country: "Португалия", lengthKm: 4.653, turns: 15, layout: "GP" },
  ];
  const insertedTracks = trackData.map((t) => db.insert(tracks).values(t).returning().get());

  const driverData: InsertDriver[] = [
    { name: "Алекс Волков", team: "Toyota Gazoo Racing", country: "RU" },
    { name: "Marco Rossi", team: "Ferrari AF Corse", country: "IT" },
    { name: "James Carter", team: "Porsche Penske", country: "GB" },
    { name: "Kenji Tanaka", team: "Toyota Gazoo Racing", country: "JP" },
    { name: "Lucas Meyer", team: "Peugeot TotalEnergies", country: "FR" },
    { name: "Дмитрий Орлов", team: "Cadillac Racing", country: "RU" },
    { name: "Sofia Blanc", team: "Alpine Endurance", country: "FR" },
    { name: "Tom Wagner", team: "BMW M Team", country: "DE" },
  ];
  const insertedDrivers = driverData.map((d) => db.insert(drivers).values(d).returning().get());

  const classes = ["Hypercar", "LMP2", "GTE"];
  const carByClass: Record<string, string[]> = {
    Hypercar: ["Toyota GR010", "Ferrari 499P", "Porsche 963", "Peugeot 9X8", "Cadillac V-Series.R"],
    LMP2: ["Oreca 07", "Ligier JS P217"],
    GTE: ["Porsche 911 RSR", "Ferrari 488 GTE", "Corvette C8.R"],
  };
  const conditionsList = ["Сухо", "Дождь", "Смешанно"];
  const tyres = ["Soft", "Medium", "Hard", "Wet"];

  const baseLapByTrack: Record<string, number> = {
    "Le Mans": 3 * 60000 + 24000,
    "Spa-Francorchamps": 2 * 60000 + 3000,
    "Monza": 1 * 60000 + 34000,
    "Fuji Speedway": 1 * 60000 + 28000,
    "Sebring": 1 * 60000 + 47000,
    "Bahrain": 1 * 60000 + 44000,
    "Imola": 1 * 60000 + 30000,
    "Portimão": 1 * 60000 + 24000,
  };

  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const lapRows: InsertLapTime[] = [];
  for (const track of insertedTracks) {
    const base = baseLapByTrack[track.name] ?? 90000;
    for (const driver of insertedDrivers) {
      const runs = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < runs; i++) {
        const carClass = classes[Math.floor(rand() * classes.length)];
        const classPenalty = carClass === "Hypercar" ? 0 : carClass === "LMP2" ? 4500 : 9000;
        const cond = conditionsList[Math.floor(rand() * conditionsList.length)];
        const condPenalty = cond === "Дождь" ? 12000 : cond === "Смешанно" ? 5000 : 0;
        const variation = Math.floor(rand() * 4000);
        const lapMs = base + classPenalty + condPenalty + variation;
        const s1 = Math.round(lapMs * 0.33);
        const s2 = Math.round(lapMs * 0.34);
        const s3 = lapMs - s1 - s2;
        const day = 1 + Math.floor(rand() * 28);
        const month = 4 + Math.floor(rand() * 3);
        const tyre = cond === "Дождь" ? "Wet" : tyres[Math.floor(rand() * 3)];
        const cars = carByClass[carClass];
        lapRows.push({
          trackId: track.id,
          driverId: driver.id,
          carClass,
          car: cars[Math.floor(rand() * cars.length)],
          lapMs,
          sector1Ms: s1,
          sector2Ms: s2,
          sector3Ms: s3,
          conditions: cond,
          tyre,
          date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          source: "demo",
          sessionId: null,
        });
      }
    }
  }
  for (const row of lapRows) db.insert(lapTimes).values(row).run();
}

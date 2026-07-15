import { tracks, drivers, lapTimes, sessions, sessionResults } from '@shared/schema';
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
import { parseRaceResults, type ParsedSession } from "./logParser";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface LapFilter {
  trackId?: number;
  driverId?: number;
  carClass?: string;
  conditions?: string;
  source?: string; // demo | import
  sessionId?: number;
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
  importLog(fileName: string, xml: string): Promise<ImportResult>;
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

    // Строим мап: driverId → maxIsPlayer
    // Если у пилота хотя бы одна запись с isPlayer=1 — он реальный игрок
    const playerMap = new Map<number, number>();
    for (const sr of srRows) {
      const current = playerMap.get(sr.driverId) ?? 0;
      if (sr.isPlayer > current) playerMap.set(sr.driverId, sr.isPlayer);
    }

    return allDrivers.map((d) => ({
      ...d,
      // null если у пилота нет ни одной записи в session_results (demo-только)
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

    const rows = conditions.length
      ? db.select().from(lapTimes).where(and(...conditions)).all()
      : db.select().from(lapTimes).all();

    const trackMap = new Map(db.select().from(tracks).all().map((t) => [t.id, t]));
    const driverMap = new Map(db.select().from(drivers).all().map((d) => [d.id, d]));

    // Строим мап: (sessionId, driverId) → isPlayer из session_results
    // Ключ: "sessionId:driverId"
    const srRows = db.select().from(sessionResults).all();
    const isPlayerMap = new Map<string, number>();
    for (const sr of srRows) {
      isPlayerMap.set(`${sr.sessionId}:${sr.driverId}`, sr.isPlayer);
    }

    return rows.map((r) => {
      const isPlayer = r.sessionId != null
        ? (isPlayerMap.get(`${r.sessionId}:${r.driverId}`) ?? null)
        : null; // demo круги не связаны с session_results
      return {
        ...r,
        trackName: trackMap.get(r.trackId)?.name ?? "—",
        driverName: driverMap.get(r.driverId)?.name ?? "—",
        team: driverMap.get(r.driverId)?.team ?? "—",
        isPlayer,
      };
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

  async importLog(fileName: string, xml: string): Promise<ImportResult> {
    let parsed: ParsedSession | null;
    try {
      parsed = parseRaceResults(xml);
    } catch (e) {
      return { fileName, ok: false, message: `Ошибка разбора: ${(e as Error).message}` };
    }
    if (!parsed) {
      return { fileName, ok: false, message: "Не похоже на лог результатов LMU/rFactor (нет RaceResults)" };
    }

    const dup = db.select().from(sessions).where(eq(sessions.fileName, fileName)).get();
    if (dup) {
      return { fileName, ok: false, message: "Уже импортировано (тот же файл)", sessionId: dup.id };
    }

    const track = this.findOrCreateTrack(parsed);
    const dateOnly = parsed.dateTimeIso.slice(0, 10);

    let totalLaps = 0;
    const session = db.insert(sessions).values({
      trackId: track.id,
      event: parsed.event,
      sessionType: parsed.sessionType,
      venue: parsed.venue,
      course: parsed.course ?? null,
      gameVersion: parsed.gameVersion ?? null,
      dateTime: parsed.dateTimeIso,
      fileName,
      driverCount: parsed.drivers.length,
      lapCount: 0,
    }).returning().get();

    for (const d of parsed.drivers) {
      const driver = this.findOrCreateDriver(d.name, d.teamName);
      const cls = normalizeClass(d.carClass);

      db.insert(sessionResults).values({
        sessionId: session.id,
        driverId: driver.id,
        isPlayer: d.isPlayer ? 1 : 0,
        position: d.position,
        classPosition: d.classPosition,
        carClass: cls,
        car: d.carType,
        team: d.teamName,
        carNumber: d.carNumber ?? null,
        laps: d.laps,
        pitstops: d.pitstops,
        bestLapMs: d.bestLapMs ?? null,
        finishStatus: d.finishStatus ?? null,
      }).run();

      for (const lap of d.lapList) {
        if (lap.lapMs == null || lap.isPit) continue;
        const s1 = lap.s1Ms ?? 0;
        const s2 = lap.s2Ms ?? 0;
        const s3 = lap.s3Ms ?? Math.max(0, lap.lapMs - s1 - s2);
        db.insert(lapTimes).values({
          trackId: track.id,
          driverId: driver.id,
          carClass: cls,
          car: d.carType,
          lapMs: lap.lapMs,
          sector1Ms: s1,
          sector2Ms: s2,
          sector3Ms: s3,
          conditions: "Сухо",
          tyre: "Medium",
          date: dateOnly,
          source: "import",
          sessionId: session.id,
        }).run();
        totalLaps++;
      }
    }

    db.update(sessions).set({ lapCount: totalLaps }).where(eq(sessions.id, session.id)).run();

    return {
      fileName,
      ok: true,
      message: "Импортировано",
      sessionId: session.id,
      event: parsed.event,
      venue: parsed.venue,
      course: parsed.course ?? null,
      laps: totalLaps,
      drivers: parsed.drivers.length,
    };
  }

  private findOrCreateTrack(parsed: ParsedSession): Track {
    // Идентифицируем трассу по комбинации venue + course (разные конфигурации = разные трассы)
    const all = db.select().from(tracks).all();
    const course = parsed.course;

    // Точное совпадение venue + course
    const exactMatch = all.find((t) => {
      const venueLower = t.name.toLowerCase();
      const parsedVenueLower = parsed.venue.toLowerCase();
      const parsedCourseNorm = (course ?? "").toLowerCase();
      const layoutNorm = (t.layout ?? "").toLowerCase();
      // Если course есть — ищем по venue и layout (layout хранит course)
      if (course) {
        return venueLower === parsedVenueLower && layoutNorm === parsedCourseNorm;
      }
      // Без course — классическое совпадение по venue
      return venueLower === parsedVenueLower;
    });
    if (exactMatch) return exactMatch;

    // Фолбэк: canonicalTrackName
    const canonical = canonicalTrackName(parsed.venue);
    const lengthKm = parsed.trackLengthM ? +(parsed.trackLengthM / 1000).toFixed(3) : 0;
    return db.insert(tracks).values({
      name: canonical.name,
      country: canonical.country,
      lengthKm,
      turns: canonical.turns,
      // Сохраняем course как layout, чтобы различать конфигурации
      layout: course ?? "Импорт",
    }).returning().get();
  }

  private findOrCreateDriver(name: string, team: string): Driver {
    const all = db.select().from(drivers).all();
    const found = all.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    return db.insert(drivers).values({
      name,
      team: team || "—",
      country: guessCountry(name),
    }).returning().get();
  }
}

export const storage = new DatabaseStorage();

function normalizeClass(raw: string): string {
  const r = (raw || "").trim();
  if (!r || r === "—") return "GT3";
  return r;
}

function canonicalTrackName(venue: string): { name: string; country: string; turns: number } {
  const v = venue.toLowerCase();
  if (v.includes("carlos pace") || v.includes("interlagos")) return { name: "Interlagos", country: "Бразилия", turns: 15 };
  if (v.includes("le mans")) return { name: "Le Mans", country: "Франция", turns: 38 };
  if (v.includes("spa")) return { name: "Spa-Francorchamps", country: "Бельгия", turns: 20 };
  if (v.includes("monza")) return { name: "Monza", country: "Италия", turns: 11 };
  if (v.includes("fuji")) return { name: "Fuji Speedway", country: "Япония", turns: 16 };
  if (v.includes("sebring")) return { name: "Sebring", country: "США", turns: 17 };
  if (v.includes("bahrain") || v.includes("sakhir")) return { name: "Bahrain", country: "Бахрейн", turns: 15 };
  if (v.includes("imola")) return { name: "Imola", country: "Италия", turns: 19 };
  if (v.includes("portim") || v.includes("algarve")) return { name: "Portimão", country: "Португалия", turns: 15 };
  if (v.includes("cota") || v.includes("americas")) return { name: "COTA", country: "США", turns: 20 };
  if (v.includes("qatar") || v.includes("losail")) return { name: "Losail", country: "Катар", turns: 16 };
  return { name: venue, country: "—", turns: 0 };
}

function guessCountry(_name: string): string {
  return "—";
}

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

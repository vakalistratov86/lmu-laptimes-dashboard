import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Трассы игры LMU
export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  country: text("country").notNull(),
  lengthKm: real("length_km").notNull(),
  turns: integer("turns").notNull(),
  layout: text("layout").notNull(), // например "Full", "GP", "National"
});

// Пилоты
export const drivers = sqliteTable("drivers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  team: text("team").notNull(),
  country: text("country").notNull(),
});

// Времена кругов (заезды)
export const lapTimes = sqliteTable("lap_times", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").notNull(),
  driverId: integer("driver_id").notNull(),
  carClass: text("car_class").notNull(), // Hypercar, LMP2, GTE, GT3
  car: text("car").notNull(),
  lapMs: integer("lap_ms").notNull(), // время круга в миллисекундах
  sector1Ms: integer("sector1_ms").notNull(),
  sector2Ms: integer("sector2_ms").notNull(),
  sector3Ms: integer("sector3_ms").notNull(),
  conditions: text("conditions").notNull(), // Сухо / Дождь / Смешанно
  tyre: text("tyre").notNull(), // Soft / Medium / Hard / Wet
  date: text("date").notNull(), // ISO дата заезда
  source: text("source").notNull().default("demo"), // demo | import
  sessionId: integer("session_id"), // ссылка на импортированную сессию (для source=import)
});

// Импортированные сессии из логов игры (rFactor/LMU XML)
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").notNull(),
  event: text("event").notNull(),           // TrackEvent, напр. "Rolex 6 Hours Of Sao Paulo"
  sessionType: text("session_type").notNull(), // Practice / Qualify / Race / Practice1 и т.д.
  venue: text("venue").notNull(),           // TrackVenue
  course: text("course"),                   // TrackCourse (может отличаться от venue)
  trackLengthM: real("track_length_m"),     // TrackLength в метрах
  gameVersion: text("game_version"),
  dateTime: text("date_time").notNull(),    // ISO дата/время сессии
  dateTimeUnix: integer("date_time_unix"),  // Unix timestamp (DateTime из XML)
  fileName: text("file_name").notNull(),    // имя загруженного файла
  setting: text("setting"),                 // Setting из XML, напр. "Race Weekend"
  driverCount: integer("driver_count").notNull(),
  lapCount: integer("lap_count").notNull(), // всего засчитанных кругов во всех результатах
  // Настройки сессии из XML
  raceLaps: integer("race_laps"),           // RaceLaps (0 = не ограничено кругами)
  raceTimeMin: integer("race_time_min"),    // RaceTime в минутах
  mechFailRate: integer("mech_fail_rate"),  // MechFailRate
  damageMult: integer("damage_mult"),       // DamageMult (75 = 75%)
  fuelMult: real("fuel_mult"),              // FuelMult
  tireMult: real("tire_mult"),              // TireMult
  vehiclesAllowed: text("vehicles_allowed"), // VehiclesAllowed (список классов/моделей)
  parcFerme: integer("parc_ferme"),         // ParcFerme
  fixedSetups: integer("fixed_setups"),     // FixedSetups
  freeSettings: integer("free_settings"),   // FreeSettings
  fixedUpgrades: integer("fixed_upgrades"), // FixedUpgrades
  tireWarmers: integer("tire_warmers"),     // TireWarmers
  dedicated: integer("dedicated"),          // Dedicated server flag
  sessionDurationMin: integer("session_duration_min"), // Minutes (для Practice/Qualify)
  sessionMaxLaps: integer("session_max_laps"),          // Laps (для Practice)
  mostLapsCompleted: integer("most_laps_completed"),    // MostLapsCompleted
});

// Результат конкретного пилота в сессии
export const sessionResults = sqliteTable("session_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  isPlayer: integer("is_player").notNull().default(0), // 1 = игрок
  position: integer("position").notNull(),
  classPosition: integer("class_position").notNull(),
  lapRankIncludingDiscos: integer("lap_rank_including_discos"), // LapRankIncludingDiscos
  carClass: text("car_class").notNull(),
  car: text("car").notNull(),
  carType: text("car_type"),                // CarType (полное название модели)
  team: text("team").notNull(),
  carNumber: text("car_number"),
  vehFile: text("veh_file"),               // VehFile (имя .VEH файла)
  vehName: text("veh_name"),               // VehName (отображаемое имя машины)
  category: text("category"),              // Category (напр. "WEC 2026, GT3, Porsche 911 GT3 R LMGT3")
  laps: integer("laps").notNull(),
  pitstops: integer("pitstops").notNull(),
  bestLapMs: integer("best_lap_ms"),       // лучший круг, мс
  finishStatus: text("finish_status"),     // FinishStatus
  controlAndAids: text("control_and_aids"), // строка управления, напр. "PlayerControl,TC=2,Clutch,AutoBlip"
  connected: integer("connected"),         // Connected (1/0)
});

// Детальные данные по каждому кругу конкретного пилота в сессии
export const sessionLaps = sqliteTable("session_laps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionResultId: integer("session_result_id").notNull(), // → session_results.id
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  lapNum: integer("lap_num").notNull(),             // Lap num=
  position: integer("position"),                    // p= (позиция на момент круга)
  lapTimeMs: real("lap_time_ms"),                   // текст Lap (null если "--.----")
  elapsedTimeSec: real("elapsed_time_sec"),          // et= (суммарное время от старта)
  sector1Ms: real("sector1_ms"),                    // s1=
  sector2Ms: real("sector2_ms"),                    // s2=
  sector3Ms: real("sector3_ms"),                    // s3=
  topSpeedKph: real("top_speed_kph"),               // topspeed=
  fuelLevel: real("fuel_level"),                    // fuel= (0..1, доля бака)
  fuelUsed: real("fuel_used"),                      // fuelUsed= (может быть отрицательным = пит)
  vehicleCondition: real("vehicle_condition"),       // ve= (0..1, состояние машины)
  vehicleConditionUsed: real("vehicle_condition_used"), // veUsed=
  tyreFLCondition: real("tyre_fl_condition"),        // twfl=
  tyreFRCondition: real("tyre_fr_condition"),        // twfr=
  tyreRLCondition: real("tyre_rl_condition"),        // twrl=
  tyreRRCondition: real("tyre_rr_condition"),        // twrr=
  frontCompound: text("front_compound"),             // fcompound= напр. "0,Medium"
  rearCompound: text("rear_compound"),              // rcompound=
  tyreFL: text("tyre_fl"),                          // FL= напр. "0,Medium"
  tyreFR: text("tyre_fr"),                          // FR=
  tyreRL: text("tyre_rl"),                          // RL=
  tyreRR: text("tyre_rr"),                          // RR=
  isPitLap: integer("is_pit_lap").notNull().default(0), // pit="1" в атрибуте
});

// Инциденты из Stream сессии
export const sessionIncidents = sqliteTable("session_incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),      // виновник инцидента
  targetDriverId: integer("target_driver_id"),   // null если контакт с неподвижным объектом
  elapsedTimeSec: real("elapsed_time_sec").notNull(), // et=
  severity: real("severity").notNull(),          // число в скобках (сила удара)
  isImmovable: integer("is_immovable").notNull().default(0), // контакт с "Immovable"
});

// Лучшие времена по секторам (Stream → Sector)
export const sessionSectorBests = sqliteTable("session_sector_bests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  carClass: text("car_class").notNull(),
  sector: integer("sector").notNull(),           // 1, 2 или 3
  elapsedTimeSec: real("elapsed_time_sec").notNull(), // et= момента установки рекорда
  lapNum: integer("lap_num"),                    // lap= из атрибута Sector
});

// Нарушения трассы (TrackLimits)
export const sessionTrackLimits = sqliteTable("session_track_limits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  lapNum: integer("lap_num").notNull(),
  elapsedTimeSec: real("elapsed_time_sec").notNull(), // et=
  warningPoints: integer("warning_points"),      // WarningPoints=
  currentPoints: integer("current_points"),      // CurrentPoints=
  resolution: integer("resolution"),             // Resolution=
  decision: text("decision"),                    // текст элемента, напр. "No Further Action"
});

export const insertTrackSchema = createInsertSchema(tracks).omit({ id: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true });
export const insertLapTimeSchema = createInsertSchema(lapTimes).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertSessionResultSchema = createInsertSchema(sessionResults).omit({ id: true });
export const insertSessionLapSchema = createInsertSchema(sessionLaps).omit({ id: true });
export const insertSessionIncidentSchema = createInsertSchema(sessionIncidents).omit({ id: true });
export const insertSessionSectorBestSchema = createInsertSchema(sessionSectorBests).omit({ id: true });
export const insertSessionTrackLimitsSchema = createInsertSchema(sessionTrackLimits).omit({ id: true });

export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertLapTime = z.infer<typeof insertLapTimeSchema>;
export type LapTime = typeof lapTimes.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSessionResult = z.infer<typeof insertSessionResultSchema>;
export type SessionResult = typeof sessionResults.$inferSelect;
export type InsertSessionLap = z.infer<typeof insertSessionLapSchema>;
export type SessionLap = typeof sessionLaps.$inferSelect;
export type InsertSessionIncident = z.infer<typeof insertSessionIncidentSchema>;
export type SessionIncident = typeof sessionIncidents.$inferSelect;
export type InsertSessionSectorBest = z.infer<typeof insertSessionSectorBestSchema>;
export type SessionSectorBest = typeof sessionSectorBests.$inferSelect;
export type InsertSessionTrackLimits = z.infer<typeof insertSessionTrackLimitsSchema>;
export type SessionTrackLimits = typeof sessionTrackLimits.$inferSelect;

// Обогащённый пилот: добавляет флаг isPlayer
// 1 = реальный игрок (хотя бы в одной сессии), 0 = только ИИ, null = нет данных сессий (demo)
export type DriverEnriched = Driver & {
  isPlayer: number | null;
};

// Обогащённая запись времени с данными трассы и пилота (для API)
export type LapTimeEnriched = LapTime & {
  trackName: string;
  driverName: string;
  team: string;
  /** 1 = живой игрок, 0 = ИИ. null для кругов demo (нет session_results). */
  isPlayer: number | null;
};

// Сессия с трассой и результатами (для API)
export type SessionEnriched = Session & {
  trackName: string;
  results: (SessionResult & { driverName: string })[];
};

// Полный результат сессии с кругами, инцидентами, секторами и нарушениями трассы
export type SessionFull = SessionEnriched & {
  laps: SessionLap[];
  incidents: SessionIncident[];
  sectorBests: SessionSectorBest[];
  trackLimits: SessionTrackLimits[];
};

import { pgTable, text, integer, real, serial, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Трассы игры LMU
export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  lengthKm: real("length_km").notNull(),
  turns: integer("turns").notNull(),
  layout: text("layout").notNull(),
});

// Пилоты
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  country: text("country").notNull(),
});

// Времена кругов (заезды)
export const lapTimes = pgTable("lap_times", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull(),
  driverId: integer("driver_id").notNull(),
  carClass: text("car_class").notNull(),
  car: text("car").notNull(),
  lapMs: integer("lap_ms").notNull(),
  // sector times are nullable: LMU may omit them for incomplete laps
  sector1Ms: integer("sector1_ms"),
  sector2Ms: integer("sector2_ms"),
  sector3Ms: integer("sector3_ms"),
  conditions: text("conditions").notNull(),
  tyre: text("tyre").notNull(),
  date: text("date").notNull(),
  source: text("source").notNull().default("demo"),
  sessionId: integer("session_id"),
});

// Импортированные сессии из логов игры (rFactor/LMU XML)
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull(),
  event: text("event").notNull(),
  sessionType: text("session_type").notNull(),
  venue: text("venue").notNull(),
  course: text("course"),
  trackLengthM: real("track_length_m"),
  gameVersion: text("game_version"),
  dateTime: text("date_time").notNull(),
  dateTimeUnix: bigint("date_time_unix", { mode: "number" }),
  fileName: text("file_name").notNull(),
  setting: text("setting"),
  driverCount: integer("driver_count").notNull(),
  lapCount: integer("lap_count").notNull(),
  raceLaps: integer("race_laps"),
  raceTimeMin: integer("race_time_min"),
  mechFailRate: integer("mech_fail_rate"),
  damageMult: integer("damage_mult"),
  fuelMult: real("fuel_mult"),
  tireMult: real("tire_mult"),
  vehiclesAllowed: text("vehicles_allowed"),
  parcFerme: integer("parc_ferme"),
  fixedSetups: integer("fixed_setups"),
  freeSettings: integer("free_settings"),
  fixedUpgrades: integer("fixed_upgrades"),
  tireWarmers: integer("tire_warmers"),
  dedicated: integer("dedicated"),
  sessionDurationMin: integer("session_duration_min"),
  sessionMaxLaps: integer("session_max_laps"),
  mostLapsCompleted: integer("most_laps_completed"),
});

// Задания импорта — idempotency + async status (#5, #6)
export const importJobs = pgTable("import_jobs", {
  id: text("id").primaryKey(),                       // nanoid
  fileHash: text("file_hash").notNull().unique(),    // SHA-256 файла — UNIQUE для idempotency
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("queued"), // queued | processing | completed | failed
  sessionId: integer("session_id"),                  // заполняется после успешного импорта
  totalLaps: integer("total_laps"),
  validLaps: integer("valid_laps"),                  // #8: кол-во прошедших валидацию кругов
  errorLaps: integer("error_laps"),                  // #8: кол-во записей в DLQ
  error: text("error"),                              // сообщение об ошибке при failed
  logFormatVersion: text("log_format_version"),      // #7: версия формата лога (1.0 | 1.1 | 2.0)
  createdAt: bigint("created_at", { mode: "number" }).notNull(), // Unix ms
  finishedAt: bigint("finished_at", { mode: "number" }),         // Unix ms
});

// Dead Letter Queue — битые/невалидные записи импорта (#8)
export const importErrors = pgTable("import_errors", {
  id: serial("id").primaryKey(),
  importJobId: text("import_job_id").notNull(),
  rawPayload: text("raw_payload").notNull(),          // исходная строка/запись (JSON)
  errorCode: text("error_code").notNull(),            // VALIDATION_ERROR | PARSE_ERROR | SEMANTIC_ERROR
  errorMessage: text("error_message").notNull(),
  occurredAt: bigint("occurred_at", { mode: "number" }).notNull(), // Unix ms
});

// Результат конкретного пилота в сессии
export const sessionResults = pgTable("session_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  isPlayer: integer("is_player").notNull().default(0),
  position: integer("position").notNull(),
  classPosition: integer("class_position").notNull(),
  lapRankIncludingDiscos: integer("lap_rank_including_discos"),
  carClass: text("car_class").notNull(),
  car: text("car").notNull(),
  carType: text("car_type"),
  team: text("team").notNull(),
  carNumber: text("car_number"),
  vehFile: text("veh_file"),
  vehName: text("veh_name"),
  category: text("category"),
  laps: integer("laps").notNull(),
  pitstops: integer("pitstops").notNull(),
  bestLapMs: integer("best_lap_ms"),
  finishStatus: text("finish_status"),
  controlAndAids: text("control_and_aids"),
  connected: integer("connected"),
});

// Детальные данные по каждому кругу конкретного пилота в сессии
export const sessionLaps = pgTable("session_laps", {
  id: serial("id").primaryKey(),
  sessionResultId: integer("session_result_id").notNull(),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  lapNum: integer("lap_num").notNull(),
  position: integer("position"),
  lapTimeMs: real("lap_time_ms"),
  elapsedTimeSec: real("elapsed_time_sec"),
  sector1Ms: real("sector1_ms"),
  sector2Ms: real("sector2_ms"),
  sector3Ms: real("sector3_ms"),
  topSpeedKph: real("top_speed_kph"),
  fuelLevel: real("fuel_level"),
  fuelUsed: real("fuel_used"),
  vehicleCondition: real("vehicle_condition"),
  vehicleConditionUsed: real("vehicle_condition_used"),
  tyreFLCondition: real("tyre_fl_condition"),
  tyreFRCondition: real("tyre_fr_condition"),
  tyreRLCondition: real("tyre_rl_condition"),
  tyreRRCondition: real("tyre_rr_condition"),
  frontCompound: text("front_compound"),
  rearCompound: text("rear_compound"),
  tyreFL: text("tyre_fl"),
  tyreFR: text("tyre_fr"),
  tyreRL: text("tyre_rl"),
  tyreRR: text("tyre_rr"),
  isPitLap: integer("is_pit_lap").notNull().default(0),
});

// Инциденты из Stream сессии
export const sessionIncidents = pgTable("session_incidents", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  targetDriverId: integer("target_driver_id"),
  elapsedTimeSec: real("elapsed_time_sec").notNull(),
  severity: real("severity").notNull(),
  isImmovable: integer("is_immovable").notNull().default(0),
});

// Лучшие времена по секторам
export const sessionSectorBests = pgTable("session_sector_bests", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  carClass: text("car_class").notNull(),
  sector: integer("sector").notNull(),
  elapsedTimeSec: real("elapsed_time_sec").notNull(),
  lapNum: integer("lap_num"),
});

// Нарушения трассы
export const sessionTrackLimits = pgTable("session_track_limits", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  lapNum: integer("lap_num").notNull(),
  elapsedTimeSec: real("elapsed_time_sec").notNull(),
  warningPoints: integer("warning_points"),
  currentPoints: integer("current_points"),
  resolution: integer("resolution"),
  decision: text("decision"),
});

// Задания импорта телеметрии (.duckdb) — idempotency по SHA-256 сырых байт файла
export const telemetryImportJobs = pgTable("telemetry_import_jobs", {
  id: text("id").primaryKey(),                                // nanoid
  fileHash: text("file_hash").notNull().unique(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("processing"),     // processing | completed | failed
  telemetrySessionId: integer("telemetry_session_id"),
  channelCount: integer("channel_count"),
  sampleCount: integer("sample_count"),
  error: text("error"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  finishedAt: bigint("finished_at", { mode: "number" }),
});

// Одна запись телеметрии на импортированный .duckdb файл (метаданные заезда)
export const telemetrySessions = pgTable("telemetry_sessions", {
  id: serial("id").primaryKey(),
  importJobId: text("import_job_id").notNull(),
  fileName: text("file_name").notNull(),
  driverName: text("driver_name"),
  steamId: text("steam_id"),
  recordingTime: text("recording_time"),
  sessionTime: text("session_time"),
  sessionType: text("session_type"),
  trackName: text("track_name"),
  trackLayout: text("track_layout"),
  weatherConditions: text("weather_conditions"),
  carName: text("car_name"),
  carClass: text("car_class"),
  carSetup: text("car_setup"),                                 // сырой JSON сетапа авто
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Реестр каналов/событий телеметрии, найденных в конкретном файле
export const telemetryChannels = pgTable("telemetry_channels", {
  id: serial("id").primaryKey(),
  telemetrySessionId: integer("telemetry_session_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),                                 // channel | event
  frequencyHz: integer("frequency_hz"),                         // только для channel
  unit: text("unit"),
  sampleCount: integer("sample_count").notNull(),
});

// Сами сэмплы телеметрии (EAV: одна таблица вместо ~100 таблиц-на-канал)
export const telemetrySamples = pgTable("telemetry_samples", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  seq: integer("seq").notNull(),                                // порядковый номер строки в исходном файле
  // Для events — реальное время (сек) из файла; для channels — NULL,
  // потребитель считает время как seq / frequencyHz канала.
  ts: real("ts"),
  value1: real("value1"),
  value2: real("value2"),
  value3: real("value3"),
  value4: real("value4"),
}, (table) => ({
  channelIdIdx: index("telemetry_samples_channel_id_idx").on(table.channelId),
}));

export const insertTrackSchema = createInsertSchema(tracks).omit({ id: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true });
// source/isPlayer: full ZodType overrides (not refine callbacks) so that
// .default() actually applies on parse() — drizzle-zod wraps refine-callback
// results in an extra .optional(), which would otherwise swallow the default.
export const insertLapTimeSchema = createInsertSchema(lapTimes, {
  source: z.string().default("demo"),
}).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertSessionResultSchema = createInsertSchema(sessionResults, {
  isPlayer: z.number().int().default(0),
}).omit({ id: true });
export const insertSessionLapSchema = createInsertSchema(sessionLaps).omit({ id: true });
export const insertSessionIncidentSchema = createInsertSchema(sessionIncidents).omit({ id: true });
export const insertSessionSectorBestSchema = createInsertSchema(sessionSectorBests).omit({ id: true });
export const insertSessionTrackLimitsSchema = createInsertSchema(sessionTrackLimits).omit({ id: true });
export const insertImportJobSchema = createInsertSchema(importJobs).omit({ id: true });
export const insertImportErrorSchema = createInsertSchema(importErrors).omit({ id: true });
export const insertTelemetryImportJobSchema = createInsertSchema(telemetryImportJobs).omit({ id: true });
export const insertTelemetrySessionSchema = createInsertSchema(telemetrySessions).omit({ id: true });
export const insertTelemetryChannelSchema = createInsertSchema(telemetryChannels).omit({ id: true });
export const insertTelemetrySampleSchema = createInsertSchema(telemetrySamples).omit({ id: true });

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
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportError = z.infer<typeof insertImportErrorSchema>;
export type ImportError = typeof importErrors.$inferSelect;
export type InsertTelemetryImportJob = z.infer<typeof insertTelemetryImportJobSchema>;
export type TelemetryImportJob = typeof telemetryImportJobs.$inferSelect;
export type InsertTelemetrySession = z.infer<typeof insertTelemetrySessionSchema>;
export type TelemetrySession = typeof telemetrySessions.$inferSelect;
export type InsertTelemetryChannel = z.infer<typeof insertTelemetryChannelSchema>;
export type TelemetryChannel = typeof telemetryChannels.$inferSelect;
export type InsertTelemetrySample = z.infer<typeof insertTelemetrySampleSchema>;
export type TelemetrySample = typeof telemetrySamples.$inferSelect;

export type DriverEnriched = Driver & {
  isPlayer: number | null;
};

export type LapTimeEnriched = LapTime & {
  trackName: string;
  driverName: string;
  team: string;
  isPlayer: number | null;
  sessionCourse: string | null;
};

export type SessionEnriched = Session & {
  trackName: string;
  results: (SessionResult & { driverName: string })[];
};

export type SessionFull = SessionEnriched & {
  laps: SessionLap[];
  incidents: SessionIncident[];
  sectorBests: SessionSectorBest[];
  trackLimits: SessionTrackLimits[];
};

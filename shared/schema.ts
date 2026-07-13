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
  event: text("event").notNull(), // TrackEvent, напр. "Rolex 6 Hours Of Sao Paulo"
  sessionType: text("session_type").notNull(), // Practice / Qualify / Race / Practice1 и т.д.
  venue: text("venue").notNull(), // TrackVenue
  gameVersion: text("game_version"),
  dateTime: text("date_time").notNull(), // ISO дата/время сессии
  fileName: text("file_name").notNull(), // имя загруженного файла
  driverCount: integer("driver_count").notNull(),
  lapCount: integer("lap_count").notNull(), // всего засчитанных кругов во всех результатах
});

// Результат конкретного пилота в сессии
export const sessionResults = sqliteTable("session_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  driverId: integer("driver_id").notNull(),
  isPlayer: integer("is_player").notNull().default(0), // 1 = игрок
  position: integer("position").notNull(),
  classPosition: integer("class_position").notNull(),
  carClass: text("car_class").notNull(),
  car: text("car").notNull(),
  team: text("team").notNull(),
  carNumber: text("car_number"),
  laps: integer("laps").notNull(),
  pitstops: integer("pitstops").notNull(),
  bestLapMs: integer("best_lap_ms"), // лучший круг, мс (может отсутствовать)
  finishStatus: text("finish_status"),
});

export const insertTrackSchema = createInsertSchema(tracks).omit({ id: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true });
export const insertLapTimeSchema = createInsertSchema(lapTimes).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertSessionResultSchema = createInsertSchema(sessionResults).omit({ id: true });

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

// Обогащённая запись времени с данными трассы и пилота (для API)
export type LapTimeEnriched = LapTime & {
  trackName: string;
  driverName: string;
  team: string;
};

// Сессия с трассой и результатами (для API)
export type SessionEnriched = Session & {
  trackName: string;
  results: (SessionResult & { driverName: string })[];
};

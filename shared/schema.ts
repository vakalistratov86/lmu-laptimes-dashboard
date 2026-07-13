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
  carClass: text("car_class").notNull(), // Hypercar, LMP2, GTE
  car: text("car").notNull(),
  lapMs: integer("lap_ms").notNull(), // время круга в миллисекундах
  sector1Ms: integer("sector1_ms").notNull(),
  sector2Ms: integer("sector2_ms").notNull(),
  sector3Ms: integer("sector3_ms").notNull(),
  conditions: text("conditions").notNull(), // Сухо / Дождь / Смешанно
  tyre: text("tyre").notNull(), // Soft / Medium / Hard / Wet
  date: text("date").notNull(), // ISO дата заезда
});

export const insertTrackSchema = createInsertSchema(tracks).omit({ id: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true });
export const insertLapTimeSchema = createInsertSchema(lapTimes).omit({ id: true });

export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertLapTime = z.infer<typeof insertLapTimeSchema>;
export type LapTime = typeof lapTimes.$inferSelect;

// Обогащённая запись времени с данными трассы и пилота (для API)
export type LapTimeEnriched = LapTime & {
  trackName: string;
  driverName: string;
  team: string;
};

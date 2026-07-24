/**
 * telemetryQuery.ts — селекторы чтения телеметрии для страницы «Телеметрия».
 *
 * Таблицы устроены как EAV (telemetry_channels + telemetry_samples), поэтому
 * здесь собираются готовые вью-модели: список записей, границы кругов
 * (по событию канала `Lap`) и выровненный по времени набор точек для графика
 * и карты трассы одного круга (GPS + педали + скорость). Частоты каналов разные
 * (GPS 10 Гц, педали 50 Гц, скорость обычно 100 Гц) — базовой временной сеткой
 * выбирается САМЫЙ частый из используемых каналов, а остальные подтягиваются
 * линейной интерполяцией между двумя ближайшими реальными сэмплами по `ts`.
 * Это даёт полную детализацию самому быстрому каналу и честно восстанавливает
 * промежуточные значения остальных каналов между их реальными точками — без
 * фильтрации/сглаживания данных и без ступенчатых дублей (как было бы при
 * простом копировании ближайшего сэмпла).
 */
import { and, desc, eq, gte, inArray, lte, max } from "drizzle-orm";
import { db } from "./storage";
import { telemetryChannels, telemetrySamples, telemetrySessions } from "@shared/schema";

const CH_GPS_LAT = "GPS Latitude";
const CH_GPS_LON = "GPS Longitude";
const CH_LAP_DIST = "Lap Dist";
const CH_THROTTLE = "Throttle Pos";
const CH_BRAKE = "Brake Pos";
const CH_SPEED = "Ground Speed";
const CH_LAP = "Lap";

export async function listTelemetrySessions() {
  return db.select().from(telemetrySessions).orderBy(desc(telemetrySessions.recordingTime));
}

export async function getTelemetrySessionWithChannels(id: number) {
  const sessionRows = await db.select().from(telemetrySessions).where(eq(telemetrySessions.id, id));
  const session = sessionRows[0];
  if (!session) return undefined;

  const channels = await db
    .select({
      id: telemetryChannels.id,
      name: telemetryChannels.name,
      kind: telemetryChannels.kind,
      frequencyHz: telemetryChannels.frequencyHz,
      unit: telemetryChannels.unit,
      sampleCount: telemetryChannels.sampleCount,
    })
    .from(telemetryChannels)
    .where(eq(telemetryChannels.telemetrySessionId, id));

  return { session, channels };
}

export interface TelemetryLap {
  lapNumber: number;
  startTs: number;
  endTs: number;
  durationSec: number;
}

/** Границы кругов по событию `Lap` (новая строка — при смене номера круга). */
export async function getSessionLaps(sessionId: number): Promise<TelemetryLap[]> {
  const channelId = await getChannelId(sessionId, CH_LAP);
  if (channelId == null) return [];

  const lapRows = await db
    .select({ ts: telemetrySamples.ts, value1: telemetrySamples.value1 })
    .from(telemetrySamples)
    .where(eq(telemetrySamples.channelId, channelId))
    .orderBy(telemetrySamples.seq);

  const validRows = lapRows.filter((r) => r.ts != null && r.value1 != null);
  if (validRows.length === 0) return [];

  const recordingEndTs = await getRecordingEndTs(sessionId);

  const laps: TelemetryLap[] = [];
  for (let i = 0; i < validRows.length; i++) {
    const startTs = validRows[i].ts as number;
    const endTs = i + 1 < validRows.length ? (validRows[i + 1].ts as number) : (recordingEndTs ?? startTs);
    laps.push({
      lapNumber: Math.round(validRows[i].value1 as number),
      startTs,
      endTs,
      durationSec: Math.max(0, endTs - startTs),
    });
  }
  return laps;
}

export interface TelemetryLapPoint {
  seq: number;
  t: number;
  lapDist: number | null;
  lat: number | null;
  lon: number | null;
  throttle: number | null;
  brake: number | null;
  speedKph: number | null;
}

export interface TelemetryLapSeries {
  lapNumber: number;
  startTs: number;
  endTs: number;
  points: TelemetryLapPoint[];
}

export async function getLapSeries(sessionId: number, lap: TelemetryLap): Promise<TelemetryLapSeries> {
  const names = [CH_GPS_LAT, CH_GPS_LON, CH_LAP_DIST, CH_THROTTLE, CH_BRAKE, CH_SPEED];
  const channelRows = await db
    .select({ id: telemetryChannels.id, name: telemetryChannels.name, frequencyHz: telemetryChannels.frequencyHz })
    .from(telemetryChannels)
    .where(and(eq(telemetryChannels.telemetrySessionId, sessionId), inArray(telemetryChannels.name, names)));

  const byName = new Map(channelRows.map((c) => [c.name, c]));
  const gpsLat = byName.get(CH_GPS_LAT);

  if (gpsLat == null || byName.get(CH_GPS_LON) == null) {
    // Без GPS нечего рисовать на карте — отдаём пустой набор точек.
    return { lapNumber: lap.lapNumber, startTs: lap.startTs, endTs: lap.endTs, points: [] };
  }

  // Базовая временная сетка — канал с максимальной частотой среди доступных
  // (обычно Ground Speed, 100 Гц), чтобы не срезать детализацию самых быстрых
  // каналов до частоты GPS (10 Гц).
  let baseChannel = gpsLat;
  for (const name of names) {
    const c = byName.get(name);
    if (c && (c.frequencyHz ?? 0) > (baseChannel.frequencyHz ?? 0)) baseChannel = c;
  }

  const base = await fetchChannelSamples(baseChannel.id, lap.startTs, lap.endTs);

  const [lat, lon, lapDist, throttle, brake, speed] = await Promise.all(
    names.map(async (name) => {
      const c = byName.get(name);
      return c == null ? [] : fetchChannelSamples(c.id, lap.startTs, lap.endTs);
    }),
  );

  const latJoined = linearInterpolateJoin(base, lat);
  const lonJoined = linearInterpolateJoin(base, lon);
  const lapDistJoined = linearInterpolateJoin(base, lapDist);
  const throttleJoined = linearInterpolateJoin(base, throttle);
  const brakeJoined = linearInterpolateJoin(base, brake);
  const speedJoined = linearInterpolateJoin(base, speed);

  const points: TelemetryLapPoint[] = base.map((row, i) => ({
    seq: i,
    t: row.ts as number,
    lapDist: lapDistJoined[i],
    lat: latJoined[i],
    lon: lonJoined[i],
    throttle: throttleJoined[i],
    brake: brakeJoined[i],
    speedKph: speedJoined[i],
  }));

  return { lapNumber: lap.lapNumber, startTs: lap.startTs, endTs: lap.endTs, points };
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

async function getChannelId(sessionId: number, name: string): Promise<number | null> {
  const rows = await db
    .select({ id: telemetryChannels.id })
    .from(telemetryChannels)
    .where(and(eq(telemetryChannels.telemetrySessionId, sessionId), eq(telemetryChannels.name, name)));
  return rows[0]?.id ?? null;
}

async function getRecordingEndTs(sessionId: number): Promise<number | null> {
  const rows = await db
    .select({ id: telemetryChannels.id })
    .from(telemetryChannels)
    .where(eq(telemetryChannels.telemetrySessionId, sessionId));
  const channelIds = rows.map((r) => r.id);
  if (channelIds.length === 0) return null;

  // MAX(ts) на стороне Postgres — не тянуть в Node все сэмплы сессии (могут быть
  // миллионы строк) только чтобы найти максимум.
  const result = await db
    .select({ maxTs: max(telemetrySamples.ts) })
    .from(telemetrySamples)
    .where(inArray(telemetrySamples.channelId, channelIds));

  return result[0]?.maxTs ?? null;
}

interface SampleRow {
  ts: number | null;
  value1: number | null;
}

async function fetchChannelSamples(channelId: number, startTs: number, endTs: number): Promise<SampleRow[]> {
  return db
    .select({ ts: telemetrySamples.ts, value1: telemetrySamples.value1 })
    .from(telemetrySamples)
    .where(
      and(
        eq(telemetrySamples.channelId, channelId),
        gte(telemetrySamples.ts, startTs),
        lte(telemetrySamples.ts, endTs),
      ),
    )
    .orderBy(telemetrySamples.seq);
}

/**
 * Сопоставляет каждой точке базовой сетки (`base`, отсортирована по ts) значение
 * из `other`, линейно интерполированное между двумя ближайшими реальными сэмплами
 * `other` по времени. За пределами диапазона `other` — берётся крайнее известное
 * значение (без экстраполяции). Оба массива идут по возрастанию ts, поэтому
 * используется двухуказательный проход за O(n+m).
 */
function linearInterpolateJoin(base: SampleRow[], other: SampleRow[]): (number | null)[] {
  const valid = other.filter((r): r is { ts: number; value1: number } => r.ts != null && r.value1 != null);

  const result: (number | null)[] = [];
  let j = 0;
  for (const row of base) {
    if (valid.length === 0 || row.ts == null) {
      result.push(null);
      continue;
    }

    while (j < valid.length - 1 && valid[j + 1].ts <= row.ts) j++;

    if (row.ts <= valid[0].ts) {
      result.push(valid[0].value1);
      continue;
    }
    if (j === valid.length - 1) {
      result.push(valid[j].value1);
      continue;
    }

    const a = valid[j];
    const b = valid[j + 1];
    const span = b.ts - a.ts;
    const frac = span > 0 ? (row.ts - a.ts) / span : 0;
    result.push(a.value1 + (b.value1 - a.value1) * frac);
  }
  return result;
}

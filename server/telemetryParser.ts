/**
 * telemetryParser.ts — чтение .duckdb файлов телеметрии Le Mans Ultimate.
 *
 * Формат файла (см. docs исследования в плане реализации):
 * - `metadata` — key/value пары о заезде (пилот, трасса, сетап и т.д.)
 * - `channelsList` (channelName, frequency Гц, unit) — реестр непрерывных каналов.
 *   Каждый хранится в одноимённой таблице с колонками `value` либо `value1..value4`,
 *   без явного `ts` в файле.
 * - `eventsList` (eventName, unit) — реестр событийных каналов. Таблицы с колонками
 *   `ts, value` либо `ts, value1..value4` — запись добавляется только при изменении.
 *
 * Все event-таблицы одного файла показывают одинаковый `ts` в самой первой строке —
 * это момент старта записи (recordingBaseTs). Канальные (channel) строки такого `ts`
 * не содержат, поэтому здесь он вычисляется и проставляется вручную как
 * `recordingBaseTs + seq / frequencyHz` — иначе каналы и события лежат на разных
 * временных шкалах и их нельзя корректно сопоставить (напр. семплы GPS с границами
 * кругов из события `Lap`).
 *
 * Сэмплы читаются потоково через `conn.stream()` + `yieldRowObjectJs()` — партиями
 * по CHUNK_SIZE, а не через `runAndReadAll()`, который материализует всю таблицу
 * в JS-память разом. На проде (крошечная VM, ~492 МБ V8 heap) полная материализация
 * телеметрии большого заезда валила процесс с out-of-memory.
 */
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { CHUNK_SIZE } from "./importWorker";

export interface TelemetrySampleRow {
  seq: number;
  ts: number | null;
  value1: number | null;
  value2: number | null;
  value3: number | null;
  value4: number | null;
}

export interface TelemetryChannelDef {
  name: string;
  kind: "channel" | "event";
  frequencyHz: number | null;
  unit: string | null;
  sampleCount: number;
}

export interface TelemetryFileMeta {
  metadata: Record<string, string>;
  /** Порядок: сначала events, затем channels — так же, как они пишутся в telemetry_channels. */
  channelDefs: TelemetryChannelDef[];
  recordingBaseTs: number | null;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Первая строка таблицы по `ts` — для recordingBaseTs, без чтения всей таблицы. */
async function readFirstTs(conn: DuckDBConnection, tableName: string): Promise<number | null> {
  const reader = await conn.runAndReadAll(`SELECT ts FROM ${quoteIdent(tableName)} LIMIT 1`);
  const rows = reader.getRowObjectsJS();
  return rows.length > 0 ? toNumberOrNull(rows[0].ts) : null;
}

/** Число строк в таблице — для sampleCount, без чтения всей таблицы. */
async function readRowCount(conn: DuckDBConnection, tableName: string): Promise<number> {
  const reader = await conn.runAndReadAll(`SELECT COUNT(*) AS c FROM ${quoteIdent(tableName)}`);
  const rows = reader.getRowObjectsJS();
  return Number(rows[0]?.c ?? 0);
}

/** Метаданные + реестр каналов/событий + recordingBaseTs. Сами таблицы — маленькие. */
async function parseTelemetryMetadata(conn: DuckDBConnection): Promise<TelemetryFileMeta> {
  const metaReader = await conn.runAndReadAll(`SELECT key, value FROM metadata`);
  const metadata: Record<string, string> = {};
  for (const row of metaReader.getRowObjectsJS()) {
    metadata[String(row.key)] = row.value == null ? "" : String(row.value);
  }

  const channelsListReader = await conn.runAndReadAll(
    `SELECT channelName, frequency, unit FROM channelsList`
  );
  const channelDefsRaw = channelsListReader.getRowObjectsJS().map((r) => ({
    name: String(r.channelName),
    frequencyHz: toNumberOrNull(r.frequency),
    unit: r.unit == null ? null : String(r.unit),
  }));

  const eventsListReader = await conn.runAndReadAll(`SELECT eventName, unit FROM eventsList`);
  const eventDefsRaw = eventsListReader.getRowObjectsJS().map((r) => ({
    name: String(r.eventName),
    unit: r.unit == null ? null : String(r.unit),
  }));

  let recordingBaseTs: number | null = null;
  const channelDefs: TelemetryChannelDef[] = [];

  for (const def of eventDefsRaw) {
    const firstTs = await readFirstTs(conn, def.name);
    if (firstTs != null && (recordingBaseTs == null || firstTs < recordingBaseTs)) {
      recordingBaseTs = firstTs;
    }
    channelDefs.push({
      name: def.name,
      kind: "event",
      frequencyHz: null,
      unit: def.unit,
      sampleCount: await readRowCount(conn, def.name),
    });
  }

  for (const def of channelDefsRaw) {
    channelDefs.push({
      name: def.name,
      kind: "channel",
      frequencyHz: def.frequencyHz,
      unit: def.unit,
      sampleCount: await readRowCount(conn, def.name),
    });
  }

  return { metadata, channelDefs, recordingBaseTs };
}

/** Потоковое чтение сэмплов таблицы канала/события партиями по CHUNK_SIZE строк. */
export async function* streamChannelRows(
  conn: DuckDBConnection,
  def: TelemetryChannelDef,
  recordingBaseTs: number | null
): AsyncGenerator<TelemetrySampleRow[]> {
  const result = await conn.stream(`SELECT * FROM ${quoteIdent(def.name)}`);
  const cols = result.columnNames();
  const hasTs = cols.includes("ts");
  const hasMulti = cols.includes("value1");
  const syntheticTs =
    !hasTs && recordingBaseTs != null && def.frequencyHz
      ? { baseTs: recordingBaseTs, frequencyHz: def.frequencyHz }
      : null;

  let seq = 0;
  let buffer: TelemetrySampleRow[] = [];

  for await (const rowsBatch of result.yieldRowObjectJs()) {
    for (const row of rowsBatch) {
      buffer.push({
        seq,
        ts: hasTs
          ? toNumberOrNull(row.ts)
          : syntheticTs
            ? syntheticTs.baseTs + seq / syntheticTs.frequencyHz
            : null,
        value1: hasMulti ? toNumberOrNull(row.value1) : toNumberOrNull(row.value),
        value2: hasMulti ? toNumberOrNull(row.value2) : null,
        value3: hasMulti ? toNumberOrNull(row.value3) : null,
        value4: hasMulti ? toNumberOrNull(row.value4) : null,
      });
      seq++;
      if (buffer.length >= CHUNK_SIZE) {
        yield buffer;
        buffer = [];
      }
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}

/**
 * Открывает .duckdb файл (read-only), читает метаданные и передаёт соединение +
 * метаданные в колбэк для потокового чтения сэмплов. Закрывает соединение/инстанс
 * по завершении колбэка (или при ошибке).
 */
export async function withTelemetryFile<T>(
  filePath: string,
  fn: (ctx: { conn: DuckDBConnection; meta: TelemetryFileMeta }) => Promise<T>
): Promise<T> {
  const instance = await DuckDBInstance.create(filePath, { access_mode: "READ_ONLY" });
  try {
    const conn = await instance.connect();
    try {
      const meta = await parseTelemetryMetadata(conn);
      return await fn({ conn, meta });
    } finally {
      conn.closeSync();
    }
  } finally {
    instance.closeSync();
  }
}

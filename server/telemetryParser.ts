/**
 * telemetryParser.ts — чтение .duckdb файлов телеметрии Le Mans Ultimate.
 *
 * Формат файла (см. docs исследования в плане реализации):
 * - `metadata` — key/value пары о заезде (пилот, трасса, сетап и т.д.)
 * - `channelsList` (channelName, frequency Гц, unit) — реестр непрерывных каналов.
 *   Каждый хранится в одноимённой таблице с колонками `value` либо `value1..value4`,
 *   без явного `ts` — время восстанавливается потребителем как seq / frequency.
 * - `eventsList` (eventName, unit) — реестр событийных каналов. Таблицы с колонками
 *   `ts, value` либо `ts, value1..value4` — запись добавляется только при изменении.
 */
import { DuckDBInstance } from "@duckdb/node-api";

export interface TelemetryChannelData {
  name: string;
  kind: "channel" | "event";
  frequencyHz: number | null;
  unit: string | null;
  rows: Array<{
    seq: number;
    ts: number | null;
    value1: number | null;
    value2: number | null;
    value3: number | null;
    value4: number | null;
  }>;
}

export interface ParsedTelemetry {
  metadata: Record<string, string>;
  channels: TelemetryChannelData[];
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

async function readTableRows(
  conn: Awaited<ReturnType<DuckDBInstance["connect"]>>,
  tableName: string
): Promise<TelemetryChannelData["rows"]> {
  const reader = await conn.runAndReadAll(`SELECT * FROM ${quoteIdent(tableName)}`);
  const cols = reader.columnNames();
  const hasTs = cols.includes("ts");
  const hasMulti = cols.includes("value1");
  const objects = reader.getRowObjectsJS();

  return objects.map((row, seq) => ({
    seq,
    ts: hasTs ? toNumberOrNull(row.ts) : null,
    value1: hasMulti ? toNumberOrNull(row.value1) : toNumberOrNull(row.value),
    value2: hasMulti ? toNumberOrNull(row.value2) : null,
    value3: hasMulti ? toNumberOrNull(row.value3) : null,
    value4: hasMulti ? toNumberOrNull(row.value4) : null,
  }));
}

/** Разбирает .duckdb файл телеметрии по пути на диске (read-only). */
export async function parseTelemetryFile(filePath: string): Promise<ParsedTelemetry> {
  const instance = await DuckDBInstance.create(filePath, { access_mode: "READ_ONLY" });
  try {
    const conn = await instance.connect();
    try {
      const metaReader = await conn.runAndReadAll(`SELECT key, value FROM metadata`);
      const metadata: Record<string, string> = {};
      for (const row of metaReader.getRowObjectsJS()) {
        metadata[String(row.key)] = row.value == null ? "" : String(row.value);
      }

      const channelsListReader = await conn.runAndReadAll(
        `SELECT channelName, frequency, unit FROM channelsList`
      );
      const channelDefs = channelsListReader.getRowObjectsJS().map((r) => ({
        name: String(r.channelName),
        frequencyHz: toNumberOrNull(r.frequency),
        unit: r.unit == null ? null : String(r.unit),
      }));

      const eventsListReader = await conn.runAndReadAll(`SELECT eventName, unit FROM eventsList`);
      const eventDefs = eventsListReader.getRowObjectsJS().map((r) => ({
        name: String(r.eventName),
        unit: r.unit == null ? null : String(r.unit),
      }));

      const channels: TelemetryChannelData[] = [];

      for (const def of channelDefs) {
        const rows = await readTableRows(conn, def.name);
        channels.push({ name: def.name, kind: "channel", frequencyHz: def.frequencyHz, unit: def.unit, rows });
      }

      for (const def of eventDefs) {
        const rows = await readTableRows(conn, def.name);
        channels.push({ name: def.name, kind: "event", frequencyHz: null, unit: def.unit, rows });
      }

      return { metadata, channels };
    } finally {
      conn.closeSync();
    }
  } finally {
    instance.closeSync();
  }
}

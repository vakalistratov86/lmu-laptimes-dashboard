/**
 * telemetryImportWorker.ts — импорт .duckdb файлов телеметрии LMU.
 *
 * Синхронный pipeline (как /api/import для XML-логов): файлы телеметрии
 * умещаются в единичные секунды обработки, отдельная очередь не нужна.
 *
 * Pipeline: временный файл на диске → parseTelemetryFile → запись в
 * telemetry_sessions / telemetry_channels / telemetry_samples внутри
 * db.transaction(), батчами по CHUNK_SIZE (переиспользован из importWorker.ts).
 */
import crypto from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "./storage";
import { telemetrySessions, telemetryChannels, telemetrySamples } from "@shared/schema";
import { parseTelemetryFile } from "./telemetryParser";
import { CHUNK_SIZE } from "./importWorker";
import { logger } from "./logger";

export interface TelemetryImportPayload {
  id: string;
  fileHash: string;
  fileName: string;
  buffer: Buffer;
}

export interface TelemetryImportResult {
  telemetrySessionId: number;
  channelCount: number;
  sampleCount: number;
}

/** SHA-256 хэш сырых байт файла (idempotency) */
export function computeFileHashBinary(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function runTelemetryImport(job: TelemetryImportPayload): Promise<TelemetryImportResult> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "lmu-telemetry-"));
  const tmpFile = path.join(tmpDir, job.fileName.endsWith(".duckdb") ? job.fileName : `${job.fileName}.duckdb`);

  try {
    await writeFile(tmpFile, job.buffer);

    const parsed = await parseTelemetryFile(tmpFile);

    const result = await db.transaction(async (tx) => {
      const sessionRows = await tx.insert(telemetrySessions).values({
        importJobId: job.id,
        fileName: job.fileName,
        driverName: parsed.metadata.DriverName ?? null,
        steamId: parsed.metadata.SteamID ?? null,
        recordingTime: parsed.metadata.RecordingTime ?? null,
        sessionTime: parsed.metadata.SessionTime ?? null,
        sessionType: parsed.metadata.SessionType ?? null,
        trackName: parsed.metadata.TrackName ?? null,
        trackLayout: parsed.metadata.TrackLayout ?? null,
        weatherConditions: parsed.metadata.WeatherConditions ?? null,
        carName: parsed.metadata.CarName ?? null,
        carClass: parsed.metadata.CarClass ?? null,
        carSetup: parsed.metadata.CarSetup ?? null,
        createdAt: Date.now(),
      }).returning();
      const session = sessionRows[0];

      const channelRows = await tx.insert(telemetryChannels).values(
        parsed.channels.map((c) => ({
          telemetrySessionId: session.id,
          name: c.name,
          kind: c.kind,
          frequencyHz: c.frequencyHz,
          unit: c.unit,
          sampleCount: c.rows.length,
        }))
      ).returning();

      const sampleRows: (typeof telemetrySamples.$inferInsert)[] = [];
      for (let i = 0; i < channelRows.length; i++) {
        const channelId = channelRows[i].id;
        for (const r of parsed.channels[i].rows) {
          sampleRows.push({
            channelId,
            seq: r.seq,
            ts: r.ts,
            value1: r.value1,
            value2: r.value2,
            value3: r.value3,
            value4: r.value4,
          });
        }
      }

      for (let i = 0; i < sampleRows.length; i += CHUNK_SIZE) {
        await tx.insert(telemetrySamples).values(sampleRows.slice(i, i + CHUNK_SIZE));
      }

      return {
        telemetrySessionId: session.id,
        channelCount: channelRows.length,
        sampleCount: sampleRows.length,
      };
    });

    logger.info(
      { importJobId: job.id, fileName: job.fileName, ...result },
      "Telemetry import completed"
    );

    return result;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

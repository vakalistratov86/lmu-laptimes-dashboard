/**
 * telemetryImportWorker.ts — импорт .duckdb файлов телеметрии LMU.
 *
 * Синхронный pipeline (как /api/import для XML-логов): файлы телеметрии
 * умещаются в единичные секунды обработки, отдельная очередь не нужна.
 *
 * Pipeline: временный файл на диске → withTelemetryFile открывает его и
 * стримит сэмплы партиями (streamChannelRows) прямо в telemetry_samples
 * внутри db.transaction() — без материализации всего датасета в JS-памяти
 * (см. telemetryParser.ts).
 */
import crypto from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "./storage";
import { telemetrySessions, telemetryChannels, telemetrySamples } from "@shared/schema";
import { withTelemetryFile, streamChannelRows } from "./telemetryParser";
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

    const result = await withTelemetryFile(tmpFile, ({ conn, meta }) =>
      db.transaction(async (tx) => {
        const sessionRows = await tx
          .insert(telemetrySessions)
          .values({
            importJobId: job.id,
            fileName: job.fileName,
            driverName: meta.metadata.DriverName ?? null,
            steamId: meta.metadata.SteamID ?? null,
            recordingTime: meta.metadata.RecordingTime ?? null,
            sessionTime: meta.metadata.SessionTime ?? null,
            sessionType: meta.metadata.SessionType ?? null,
            trackName: meta.metadata.TrackName ?? null,
            trackLayout: meta.metadata.TrackLayout ?? null,
            weatherConditions: meta.metadata.WeatherConditions ?? null,
            carName: meta.metadata.CarName ?? null,
            carClass: meta.metadata.CarClass ?? null,
            carSetup: meta.metadata.CarSetup ?? null,
            createdAt: Date.now(),
          })
          .returning();
        const session = sessionRows[0];

        const channelRows = await tx
          .insert(telemetryChannels)
          .values(
            meta.channelDefs.map((d) => ({
              telemetrySessionId: session.id,
              name: d.name,
              kind: d.kind,
              frequencyHz: d.frequencyHz,
              unit: d.unit,
              sampleCount: d.sampleCount,
            })),
          )
          .returning();

        let sampleCount = 0;
        for (let i = 0; i < channelRows.length; i++) {
          const channelId = channelRows[i].id;
          const def = meta.channelDefs[i];
          for await (const batch of streamChannelRows(conn, def, meta.recordingBaseTs)) {
            await tx.insert(telemetrySamples).values(
              batch.map((r) => ({
                channelId,
                seq: r.seq,
                ts: r.ts,
                value1: r.value1,
                value2: r.value2,
                value3: r.value3,
                value4: r.value4,
              })),
            );
            sampleCount += batch.length;
          }
        }

        return {
          telemetrySessionId: session.id,
          channelCount: channelRows.length,
          sampleCount,
        };
      }),
    );

    logger.info({ importJobId: job.id, fileName: job.fileName, ...result }, "Telemetry import completed");

    return result;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

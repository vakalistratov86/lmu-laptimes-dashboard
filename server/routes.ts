import type { Express } from "express";
import type { Server } from 'node:http';
import { storage, type LapFilter, db } from "./storage";
import { tracks, drivers, lapTimes, sessions, sessionResults } from '@shared/schema';
import { eq, notInArray } from "drizzle-orm";
import { getSpecialEvents, invalidateCache } from "./eventsParser";
import { enqueueImport, getJobStatus } from "./importWorker";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/tracks", async (_req, res) => {
    res.json(await storage.getTracks());
  });

  app.get("/api/tracks/:id", async (req, res) => {
    const track = await storage.getTrack(Number(req.params.id));
    if (!track) return res.status(404).json({ message: "Трасса не найдена" });
    res.json(track);
  });

  app.get("/api/drivers", async (_req, res) => {
    res.json(await storage.getDrivers());
  });

  app.get("/api/drivers/:id", async (req, res) => {
    const driver = await storage.getDriver(Number(req.params.id));
    if (!driver) return res.status(404).json({ message: "Пилот не найден" });
    res.json(driver);
  });

  app.get("/api/laps", async (req, res) => {
    const filter: LapFilter = {};
    if (req.query.trackId) filter.trackId = Number(req.query.trackId);
    if (req.query.driverId) filter.driverId = Number(req.query.driverId);
    if (req.query.carClass) filter.carClass = String(req.query.carClass);
    if (req.query.conditions) filter.conditions = String(req.query.conditions);
    if (req.query.source) filter.source = String(req.query.source);
    if (req.query.sessionId) filter.sessionId = Number(req.query.sessionId);
    res.json(await storage.getLaps(filter));
  });

  app.get("/api/sessions", async (_req, res) => {
    res.json(await storage.getSessions());
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const session = await storage.getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ message: "Сессия не найдена" });
    res.json(session);
  });

  /**
   * POST /api/import — async ingestion (#5)
   *
   * Принимает массив файлов, для каждого:
   *   - вычисляет SHA-256 хэш (#6)
   *   - если файл уже импортирован → 409 Conflict
   *   - иначе ставит задачу в очередь → 202 Accepted { importId, status: 'queued' }
   *
   * Парсинг и запись в БД происходят асинхронно в importWorker,
   * не блокируя HTTP event loop.
   */
  app.post("/api/import", (req, res) => {
    const files = req.body?.files;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: "Не переданы файлы для импорта" });
    }

    const results: any[] = [];
    let hasDuplicate = false;

    for (const f of files) {
      const fileName = String(f?.fileName ?? "без_имени.xml");
      const content = String(f?.content ?? "");

      if (!content.trim()) {
        results.push({ fileName, ok: false, status: 409, message: "Пустой файл" });
        continue;
      }

      try {
        const importId = enqueueImport(fileName, content);
        results.push({ fileName, ok: true, importId, status: "queued" });
      } catch (e: any) {
        if (e.code === "DUPLICATE_FILE") {
          hasDuplicate = true;
          results.push({
            fileName,
            ok: false,
            status: 409,
            message: "Файл уже был импортирован",
            importId: e.importId,
            importStatus: e.status,
          });
        } else {
          results.push({ fileName, ok: false, status: 500, message: e.message });
        }
      }
    }

    const queued = results.filter((r) => r.ok).length;
    const httpStatus = queued > 0 ? 202 : (hasDuplicate ? 409 : 400);
    res.status(httpStatus).json({ queued, total: results.length, results });
  });

  /**
   * GET /api/import/:id/status — polling статуса задачи (#5)
   *
   * Возвращает текущий статус задачи импорта:
   *   queued | processing | completed | failed
   */
  app.get("/api/import/:id/status", (req, res) => {
    const job = getJobStatus(req.params.id);
    if (!job) return res.status(404).json({ message: "Задача не найдена" });
    res.json({
      importId: job.id,
      fileName: job.fileName,
      status: job.status,
      sessionId: job.sessionId ?? null,
      totalLaps: job.totalLaps ?? null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt ?? null,
    });
  });

  // ── Demo Data ────────────────────────────────────────────────────
  app.delete("/api/demo", (_req, res) => {
    db.delete(lapTimes).where(eq(lapTimes.source, "demo")).run();

    const usedTrackIds = db.select({ id: lapTimes.trackId }).from(lapTimes).all().map((r) => r.id);
    const sessionTrackIds = db.select({ id: sessions.trackId }).from(sessions).all().map((r) => r.id);
    const keepTrackIds = [...new Set([...usedTrackIds, ...sessionTrackIds])];
    if (keepTrackIds.length > 0) {
      db.delete(tracks).where(notInArray(tracks.id, keepTrackIds)).run();
    } else {
      db.delete(tracks).run();
    }

    const usedDriverIds = db.select({ id: lapTimes.driverId }).from(lapTimes).all().map((r) => r.id);
    const sessionDriverIds = db.select({ id: sessionResults.driverId }).from(sessionResults).all().map((r) => r.id);
    const keepDriverIds = [...new Set([...usedDriverIds, ...sessionDriverIds])];
    if (keepDriverIds.length > 0) {
      db.delete(drivers).where(notInArray(drivers.id, keepDriverIds)).run();
    } else {
      db.delete(drivers).run();
    }

    res.json({ ok: true, message: "Демо-данные удалены" });
  });

  // ── Special Events ──────────────────────────────────────────────
  app.get("/api/special-events", async (_req, res) => {
    try {
      const data = await getSpecialEvents();
      res.json(data);
    } catch (e) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  app.post("/api/special-events/refresh", async (_req, res) => {
    invalidateCache();
    try {
      const data = await getSpecialEvents();
      res.json({ ok: true, fetchedAt: data.fetchedAt, count: data.events.length });
    } catch (e) {
      res.status(500).json({ ok: false, message: (e as Error).message });
    }
  });

  return httpServer;
}

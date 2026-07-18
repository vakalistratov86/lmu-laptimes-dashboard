import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from 'node:http';
import { storage, type LapFilter, db } from "./storage";
import { importJobs, importErrors, tracks, drivers, lapTimes, sessions, sessionResults, sessionLaps, sessionIncidents, sessionSectorBests, sessionTrackLimits } from '@shared/schema';
import { eq, notInArray } from "drizzle-orm";
import { getSpecialEvents, invalidateCache } from "./eventsParser";
import { computeFileHash, generateId, getJobStatus, getJobErrors, runImport } from "./importWorker";

/**
 * Wraps an async route handler so that any rejected Promise is forwarded
 * to Express's next(err) — required in Express 4 which does NOT catch
 * unhandled rejections automatically (fixed only in Express 5).
 * Fixes issue #65.
 */
const asyncRoute =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/tracks", asyncRoute(async (_req, res) => {
    res.json(await storage.getTracks());
  }));

  app.get("/api/tracks/:id", asyncRoute(async (req, res) => {
    const track = await storage.getTrack(Number(req.params.id));
    if (!track) return res.status(404).json({ message: "Трасса не найдена" });
    res.json(track);
  }));

  app.get("/api/drivers", asyncRoute(async (_req, res) => {
    res.json(await storage.getDrivers());
  }));

  app.get("/api/drivers/:id", asyncRoute(async (req, res) => {
    const driver = await storage.getDriver(Number(req.params.id));
    if (!driver) return res.status(404).json({ message: "Пилот не найден" });
    res.json(driver);
  }));

  app.get("/api/laps", asyncRoute(async (req, res) => {
    const filter: LapFilter = {};
    if (req.query.trackId) filter.trackId = Number(req.query.trackId);
    if (req.query.driverId) filter.driverId = Number(req.query.driverId);
    if (req.query.carClass) filter.carClass = String(req.query.carClass);
    if (req.query.conditions) filter.conditions = String(req.query.conditions);
    if (req.query.source) filter.source = String(req.query.source);
    if (req.query.sessionId) filter.sessionId = Number(req.query.sessionId);
    res.json(await storage.getLaps(filter));
  }));

  app.get("/api/sessions", asyncRoute(async (_req, res) => {
    res.json(await storage.getSessions());
  }));

  app.get("/api/sessions/:id", asyncRoute(async (req, res) => {
    const session = await storage.getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ message: "Сессия не найдена" });
    res.json(session);
  }));

  /**
   * GET /api/sessions/:id/laps — детальные данные по кругам сессии.
   * Возвращает записи из таблицы session_laps, обогащённые именем пилота.
   * Используется вкладками «Круги», «Секторы» и «Прогресс» на странице SessionDetail.
   */
  app.get("/api/sessions/:id/laps", asyncRoute(async (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: "Некорректный id сессии" });
    }

    const lapsRows = await db
      .select()
      .from(sessionLaps)
      .where(eq(sessionLaps.sessionId, sessionId));

    const allDrivers = await db.select().from(drivers);
    const driverMap = new Map(allDrivers.map((d) => [d.id, d]));

    // Получаем isPlayer из sessionResults для каждого пилота
    const srRows = await db
      .select()
      .from(sessionResults)
      .where(eq(sessionResults.sessionId, sessionId));
    const isPlayerMap = new Map(srRows.map((r) => [r.driverId, r.isPlayer]));
    const carNumberMap = new Map(srRows.map((r) => [r.driverId, r.carNumber ?? null]));

    const enriched = lapsRows.map((lap) => ({
      ...lap,
      // Поля для совместимости с sessionDetailSelectors (buildDriverLapGroups / buildLapProgressSeries)
      lapNumber: lap.lapNum,
      lapTimeSeconds: lap.lapTimeMs != null ? lap.lapTimeMs / 1000 : null,
      sector1: lap.sector1Ms != null ? lap.sector1Ms / 1000 : null,
      sector2: lap.sector2Ms != null ? lap.sector2Ms / 1000 : null,
      sector3: lap.sector3Ms != null ? lap.sector3Ms / 1000 : null,
      isPitLap: lap.isPitLap === 1,
      driverName: driverMap.get(lap.driverId)?.name ?? "—",
      carNumber: carNumberMap.get(lap.driverId) ?? null,
      isPlayer: isPlayerMap.get(lap.driverId) ?? 0,
    }));

    res.json(enriched);
  }));

  /**
   * POST /api/import — synchronous ingestion.
   *
   * PostgreSQL transactions for typical LMU files (~5 000 rows) complete in
   * well under 500 ms, so there is no benefit to an async queue here.
   * runImport() is called directly and awaited; the response is sent
   * only after all files are persisted. Duplicate-file detection is
   * preserved via SHA-256 hash.
   */
  app.post("/api/import", asyncRoute(async (req, res) => {
    const files = req.body?.files;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: "Не переданы файлы для импорта" });
    }

    const results: any[] = [];
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let totalLaps = 0;

    for (const f of files) {
      const fileName = String(f?.fileName ?? "без_имени.xml");
      const content = String(f?.content ?? "");

      if (!content.trim()) {
        results.push({ fileName, ok: false, status: 409, message: "Пустой файл" });
        skipped++;
        continue;
      }

      // Idempotency check (#6): SHA-256 hash
      const fileHash = computeFileHash(content);
      const existingRows = await db
        .select()
        .from(importJobs)
        .where(eq(importJobs.fileHash, fileHash));
      const existing = existingRows[0];

      if (existing) {
        skipped++;
        results.push({
          fileName,
          ok: false,
          status: 409,
          message: "Файл уже был импортирован",
          importId: existing.id,
          importStatus: existing.status,
        });
        continue;
      }

      // Создаём запись задачи со статусом processing до запуска импорта
      const id = generateId();
      await db.insert(importJobs).values({
        id,
        fileHash,
        fileName,
        status: "processing",
        createdAt: Date.now(),
      });

      try {
        const { sessionId, totalLaps: laps, validLaps, errorLaps } = await runImport({
          id,
          fileHash,
          fileName,
          content,
        });

        await db.update(importJobs)
          .set({ status: "completed", sessionId, totalLaps: laps, validLaps, errorLaps, finishedAt: Date.now() })
          .where(eq(importJobs.id, id));

        imported++;
        totalLaps += validLaps;
        results.push({ fileName, ok: true, importId: id, sessionId, laps: validLaps, errorLaps });
      } catch (e: any) {
        if (e.code === "ZERO_LAPS") {
          // Файл валидный, но кругов нет — считаем пропуском, не ошибкой
          await db.update(importJobs)
            .set({ status: "skipped", error: e.message, finishedAt: Date.now() })
            .where(eq(importJobs.id, id));
          skipped++;
          results.push({
            fileName,
            ok: true,
            skipped: true,
            status: 200,
            message: "Файл пропущен: 0 кругов",
            importId: id,
          });
        } else {
          await db.update(importJobs)
            .set({ status: "failed", error: e.message, finishedAt: Date.now() })
            .where(eq(importJobs.id, id));
          errors++;
          results.push({ fileName, ok: false, status: 500, message: e.message, importId: id });
        }
      }
    }

    // 200 если есть хоть один успешный импорт или все «неуспехи» — только пропуски
    const httpStatus = imported > 0 || errors === 0 ? 200 : 400;
    res.status(httpStatus).json({ imported, skipped, totalLaps, total: results.length, results });
  }));

  /**
   * DELETE /api/import/all — полная очистка БД.
   * Удаляет все импортированные данные: круги, сессии, пилоты, трассы,
   * задачи импорта и ошибки DLQ. Используется кнопкой "Очистить БД" на
   * вкладке импорта.
   */
  app.delete("/api/import/all", asyncRoute(async (_req, res) => {
    await db.transaction(async (tx) => {
      await tx.delete(sessionTrackLimits);
      await tx.delete(sessionSectorBests);
      await tx.delete(sessionIncidents);
      await tx.delete(sessionLaps);
      await tx.delete(lapTimes);
      await tx.delete(sessionResults);
      await tx.delete(sessions);
      await tx.delete(importErrors);
      await tx.delete(importJobs);
      await tx.delete(drivers);
      await tx.delete(tracks);
    });
    res.json({ ok: true, message: "База данных успешно очищена" });
  }));

  /**
   * GET /api/import/:id/status — статус задачи (#5)
   */
  app.get("/api/import/:id/status", asyncRoute(async (req, res) => {
    const job = await getJobStatus(req.params.id);
    if (!job) return res.status(404).json({ message: "Задача не найдена" });
    res.json({
      importId: job.id,
      fileName: job.fileName,
      status: job.status,
      sessionId: job.sessionId ?? null,
      totalLaps: job.totalLaps ?? null,
      validLaps: job.validLaps ?? null,
      errorLaps: job.errorLaps ?? null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt ?? null,
    });
  }));

  /**
   * GET /api/import/:id/errors — просмотр DLQ ошибок импорта (#8)
   */
  app.get("/api/import/:id/errors", asyncRoute(async (req, res) => {
    const job = await getJobStatus(req.params.id);
    if (!job) return res.status(404).json({ message: "Задача не найдена" });
    const errors = await getJobErrors(req.params.id);
    res.json({
      importId: job.id,
      fileName: job.fileName,
      status: job.status,
      totalErrors: errors.length,
      errors,
    });
  }));

  // ── Demo Data ────────────────────────────────────────────────────
  app.delete("/api/demo", asyncRoute(async (_req, res) => {
    await db.delete(lapTimes).where(eq(lapTimes.source, "demo"));

    const usedTrackRows = await db.select({ id: lapTimes.trackId }).from(lapTimes);
    const sessionTrackRows = await db.select({ id: sessions.trackId }).from(sessions);
    const keepTrackIds = [...new Set([
      ...usedTrackRows.map((r) => r.id),
      ...sessionTrackRows.map((r) => r.id),
    ])];
    if (keepTrackIds.length > 0) {
      await db.delete(tracks).where(notInArray(tracks.id, keepTrackIds));
    } else {
      await db.delete(tracks);
    }

    const usedDriverRows = await db.select({ id: lapTimes.driverId }).from(lapTimes);
    const sessionDriverRows = await db.select({ id: sessionResults.driverId }).from(sessionResults);
    const keepDriverIds = [...new Set([
      ...usedDriverRows.map((r) => r.id),
      ...sessionDriverRows.map((r) => r.id),
    ])];
    if (keepDriverIds.length > 0) {
      await db.delete(drivers).where(notInArray(drivers.id, keepDriverIds));
    } else {
      await db.delete(drivers);
    }

    res.json({ ok: true, message: "Демо-данные удалены" });
  }));

  // ── Special Events ──────────────────────────────────────────────
  app.get("/api/special-events", asyncRoute(async (_req, res) => {
    const data = await getSpecialEvents();
    res.json(data);
  }));

  app.post("/api/special-events/refresh", asyncRoute(async (_req, res) => {
    invalidateCache();
    const data = await getSpecialEvents();
    res.json({ ok: true, fetchedAt: data.fetchedAt, count: data.events.length });
  }));

  return httpServer;
}

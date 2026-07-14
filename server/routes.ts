import type { Express } from "express";
import type { Server } from 'node:http';
import { storage, seedIfEmpty, type LapFilter } from "./storage";
import { getSpecialEvents, invalidateCache } from "./eventsParser";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  seedIfEmpty();

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

  app.post("/api/import", async (req, res) => {
    const files = req.body?.files;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: "Не переданы файлы для импорта" });
    }
    const results = [];
    for (const f of files) {
      const fileName = String(f?.fileName ?? "без_имени.xml");
      const content = String(f?.content ?? "");
      if (!content.trim()) {
        results.push({ fileName, ok: false, message: "Пустой файл" });
        continue;
      }
      try {
        results.push(await storage.importLog(fileName, content));
      } catch (e) {
        results.push({ fileName, ok: false, message: (e as Error).message });
      }
    }
    const imported = results.filter((r) => r.ok).length;
    const totalLaps = results.reduce((s, r) => s + (r.laps ?? 0), 0);
    res.json({ imported, skipped: results.length - imported, totalLaps, results });
  });

  // ── Special Events ──────────────────────────────────────────────
  // GET /api/special-events — список событий (кэш 6ч, fallback на статику)
  app.get("/api/special-events", async (_req, res) => {
    try {
      const data = await getSpecialEvents();
      res.json(data);
    } catch (e) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  // POST /api/special-events/refresh — принудительный сброс кэша
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

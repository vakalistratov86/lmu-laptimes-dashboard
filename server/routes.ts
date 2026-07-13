import type { Express } from "express";
import type { Server } from 'node:http';
import { storage, seedIfEmpty, type LapFilter } from "./storage";

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
    res.json(await storage.getLaps(filter));
  });

  return httpServer;
}

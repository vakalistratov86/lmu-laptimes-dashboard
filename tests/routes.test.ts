import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import { registerRoutes } from "../server/routes";

// ---------------------------------------------------------------------------
// Мок db (drizzle-orm/postgres-js): каждый метод возвращает "thenable"-цепочку,
// которую можно как await-ить напрямую (db.select().from(x)), так и продолжить
// чейнить (.where(), .set(), .values(), .returning()) — как настоящий drizzle
// query builder на postgres-js (в отличие от better-sqlite3, тут нет .all()).
// ---------------------------------------------------------------------------
const { db, chain } = vi.hoisted(() => {
  function chain(result: unknown = undefined): any {
    const promise = Promise.resolve(result);
    return Object.assign(promise, {
      from: vi.fn(() => chain(result)),
      where: vi.fn(() => chain(result)),
      values: vi.fn(() => chain(result)),
      set: vi.fn(() => chain(result)),
      returning: vi.fn(() => chain(result)),
    });
  }
  const db = {
    select: vi.fn(() => chain([])),
    insert: vi.fn(() => chain(undefined)),
    update: vi.fn(() => chain(undefined)),
    delete: vi.fn(() => chain(undefined)),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return { db, chain };
});

// ---------------------------------------------------------------------------
// Мок хранилища
// ---------------------------------------------------------------------------
vi.mock("../server/storage", () => ({
  storage: {
    getTracks: vi.fn().mockResolvedValue([]),
    getTrack: vi.fn(),
    getDrivers: vi.fn().mockResolvedValue([]),
    getDriver: vi.fn(),
    getDriverIncidents: vi.fn().mockResolvedValue({ incidents: [], trackLimits: [] }),
    getLaps: vi.fn().mockResolvedValue([]),
    getBestLaps: vi.fn().mockResolvedValue([]),
    getSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn(),
    getSessionLapsEnriched: vi.fn().mockResolvedValue([]),
  },
  db,
}));

// ---------------------------------------------------------------------------
// Мок importWorker — POST /api/import синхронный (routes.ts вызывает
// runImport() напрямую и ждёт результат; очередь enqueueImport удалена).
// ---------------------------------------------------------------------------
vi.mock("../server/importWorker", () => ({
  computeFileHash: vi.fn((content: string) => `hash-${content}`),
  generateId: vi.fn(() => "mock-job-id"),
  runImport: vi.fn().mockResolvedValue({ sessionId: 1, totalLaps: 5, validLaps: 5, errorLaps: 0 }),
  getJobStatus: vi.fn(),
  getJobErrors: vi.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Мок eventsParser
// ---------------------------------------------------------------------------
vi.mock("../server/eventsParser", () => ({
  getSpecialEvents: vi.fn().mockResolvedValue({
    events: [],
    fetchedAt: new Date().toISOString(),
    sourceUrl: "",
  }),
  invalidateCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------
async function buildTestApp(): Promise<{ app: Express; server: http.Server }> {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  await registerRoutes(server, app);
  return { app, server };
}

function makeRequest(
  app: Express,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const mockReq = {
      method,
      url: path,
      path,
      query: {},
      params: {},
      headers: { "content-type": "application/json", ...headers },
      body: body ?? {},
    } as unknown as import("express").Request;

    const mockRes = {
      statusCode: 200,
      _headers: {} as Record<string, string>,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: unknown) {
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      setHeader(k: string, v: string) {
        this._headers[k] = v;
        return this;
      },
      getHeader(k: string) {
        return this._headers[k];
      },
      send(data: unknown) {
        resolve({ status: this.statusCode, body: data });
        return this;
      },
    } as unknown as import("express").Response;

    app.handle(mockReq, mockRes, () => resolve({ status: 404, body: { message: "Not Found" } }));
  });
}

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------
const TEST_ADMIN_TOKEN = "test-admin-token";
const authHeader = { authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

describe("API Routes", () => {
  let app: Express;
  let server: http.Server;
  let storage: Awaited<typeof import("../server/storage")>["storage"];
  let importWorker: typeof import("../server/importWorker");
  let originalAdminToken: string | undefined;

  beforeAll(() => {
    originalAdminToken = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
  });

  afterAll(() => {
    process.env.ADMIN_TOKEN = originalAdminToken;
  });

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    server = result.server;
    storage = (await import("../server/storage")).storage;
    importWorker = await import("../server/importWorker");
  });

  afterEach(() => {
    vi.clearAllMocks();
    server.close();
  });

  // ── GET /api/tracks ──────────────────────────────────────────────────────
  describe("GET /api/tracks", () => {
    it("возвращает 200 и пустой массив", async () => {
      const res = await makeRequest(app, "GET", "/api/tracks");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("вызывает storage.getTracks()", async () => {
      await makeRequest(app, "GET", "/api/tracks");
      expect(storage.getTracks).toHaveBeenCalled();
    });

    it("возвращает трассы из хранилища", async () => {
      const mockTracks = [
        { id: 1, name: "Le Mans", country: "FR", lengthKm: 13.6, turns: 38, layout: "Full" },
        { id: 2, name: "Spa", country: "BE", lengthKm: 7.0, turns: 19, layout: "Full" },
      ];
      (storage.getTracks as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockTracks);
      const res = await makeRequest(app, "GET", "/api/tracks");
      expect(res.status).toBe(200);
      expect((res.body as typeof mockTracks).length).toBe(2);
    });
  });

  // ── GET /api/tracks/:id ──────────────────────────────────────────────────
  describe("GET /api/tracks/:id", () => {
    it("возвращает 404 если getTrack вернул undefined", async () => {
      (storage.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, "GET", "/api/tracks/999");
      expect(res.status).toBe(404);
    });

    it("возвращает трассу если нашли", async () => {
      const mockTrack = { id: 1, name: "Le Mans", country: "FR", lengthKm: 13.6, turns: 38, layout: "Full" };
      (storage.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockTrack);
      const res = await makeRequest(app, "GET", "/api/tracks/1");
      expect(res.status).toBe(200);
      expect((res.body as typeof mockTrack).name).toBe("Le Mans");
    });

    it("передаёт id как число в storage.getTrack", async () => {
      (storage.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      await makeRequest(app, "GET", "/api/tracks/42");
      expect(storage.getTrack).toHaveBeenCalledWith(42);
    });

    // #124: нечисловой :id раньше молча превращался в NaN и уходил в SQL-запрос.
    it("возвращает 400 для нечислового id, не вызывая storage.getTrack", async () => {
      const res = await makeRequest(app, "GET", "/api/tracks/abc");
      expect(res.status).toBe(400);
      expect(storage.getTrack).not.toHaveBeenCalled();
    });
  });

  // ── GET /api/drivers ─────────────────────────────────────────────────────
  describe("GET /api/drivers", () => {
    it("возвращает 200 и пустой массив", async () => {
      const res = await makeRequest(app, "GET", "/api/drivers");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("возвращает пилотов из хранилища", async () => {
      const mockDrivers = [{ id: 1, name: "Пилот А", team: "Toyota", country: "JP" }];
      (storage.getDrivers as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDrivers);
      const res = await makeRequest(app, "GET", "/api/drivers");
      expect((res.body as typeof mockDrivers)[0].name).toBe("Пилот А");
    });

    // #124: невалидный limit (не число / ≤ 0) отклоняется явной 400-ошибкой
    // вместо молчаливого fallback на дефолт.
    it("#124: нечисловой limit возвращает 400, не вызывая storage.getDrivers", async () => {
      const mockReq = {
        method: "GET",
        url: "/api/drivers?limit=abc",
        path: "/api/drivers",
        query: { limit: "abc" },
        params: {},
        headers: { "content-type": "application/json" },
        body: {},
      } as unknown as import("express").Request;
      const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
        const mockRes = {
          statusCode: 200,
          _headers: {} as Record<string, string>,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: unknown) {
            resolve({ status: this.statusCode, body: data });
            return this;
          },
          setHeader(k: string, v: string) {
            this._headers[k] = v;
            return this;
          },
          getHeader(k: string) {
            return this._headers[k];
          },
          send(data: unknown) {
            resolve({ status: this.statusCode, body: data });
            return this;
          },
        } as unknown as import("express").Response;
        app.handle(mockReq, mockRes, () => resolve({ status: 404, body: { message: "Not Found" } }));
      });
      expect(res.status).toBe(400);
      expect(storage.getDrivers).not.toHaveBeenCalled();
    });
  });

  // ── GET /api/drivers/:id ─────────────────────────────────────────────────
  describe("GET /api/drivers/:id", () => {
    it("возвращает 404 если getDriver вернул undefined", async () => {
      (storage.getDriver as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, "GET", "/api/drivers/999");
      expect(res.status).toBe(404);
    });

    it("возвращает пилота если нашли", async () => {
      const mockDriver = { id: 5, name: "Пилот Б", team: "Ferrari", country: "IT" };
      (storage.getDriver as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDriver);
      const res = await makeRequest(app, "GET", "/api/drivers/5");
      expect(res.status).toBe(200);
      expect((res.body as typeof mockDriver).team).toBe("Ferrari");
    });
  });

  // ── GET /api/laps ─────────────────────────────────────────────────────────
  describe("GET /api/laps", () => {
    it("возвращает 200", async () => {
      const res = await makeRequest(app, "GET", "/api/laps");
      expect(res.status).toBe(200);
    });

    it("передаёт trackId из query в фильтр", async () => {
      const mockReq = {
        method: "GET",
        url: "/api/laps?trackId=3",
        path: "/api/laps",
        query: { trackId: "3" },
        params: {},
        headers: { "content-type": "application/json" },
        body: {},
      } as unknown as import("express").Request;
      const mockRes = {
        statusCode: 200,
        _headers: {} as Record<string, string>,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(_data: unknown) {
          return this;
        },
        setHeader(k: string, v: string) {
          this._headers[k] = v;
          return this;
        },
        getHeader(k: string) {
          return this._headers[k];
        },
        send(_data: unknown) {
          return this;
        },
      } as unknown as import("express").Response;
      await new Promise<void>((resolve) => {
        app.handle(mockReq, mockRes, () => resolve());
        setTimeout(resolve, 50);
      });
      // #121: второй аргумент — пагинация; при заданном фильтре и без явного
      // limit она не применяется (undefined) — фильтрованный запрос и так
      // ограничен реальным числом строк по смыслу.
      expect(storage.getLaps).toHaveBeenCalledWith(expect.objectContaining({ trackId: 3 }), undefined);
    });

    it("#121: без фильтра применяет дефолтный limit/offset", async () => {
      const mockReq = {
        method: "GET",
        url: "/api/laps",
        path: "/api/laps",
        query: {},
        params: {},
        headers: { "content-type": "application/json" },
        body: {},
      } as unknown as import("express").Request;
      const mockRes = {
        statusCode: 200,
        _headers: {} as Record<string, string>,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(_data: unknown) {
          return this;
        },
        setHeader(k: string, v: string) {
          this._headers[k] = v;
          return this;
        },
        getHeader(k: string) {
          return this._headers[k];
        },
        send(_data: unknown) {
          return this;
        },
      } as unknown as import("express").Response;
      await new Promise<void>((resolve) => {
        app.handle(mockReq, mockRes, () => resolve());
        setTimeout(resolve, 50);
      });
      expect(storage.getLaps).toHaveBeenCalledWith({}, { limit: 500, offset: 0 });
    });

    // #124: раньше `Number(req.query.trackId)` превращал невалидный trackId в
    // NaN и молча передавал его дальше в SQL-фильтр вместо явной ошибки.
    it("#124: нечисловой trackId возвращает 400, не вызывая storage.getLaps", async () => {
      const mockReq = {
        method: "GET",
        url: "/api/laps?trackId=abc",
        path: "/api/laps",
        query: { trackId: "abc" },
        params: {},
        headers: { "content-type": "application/json" },
        body: {},
      } as unknown as import("express").Request;
      const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
        const mockRes = {
          statusCode: 200,
          _headers: {} as Record<string, string>,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: unknown) {
            resolve({ status: this.statusCode, body: data });
            return this;
          },
          setHeader(k: string, v: string) {
            this._headers[k] = v;
            return this;
          },
          getHeader(k: string) {
            return this._headers[k];
          },
          send(data: unknown) {
            resolve({ status: this.statusCode, body: data });
            return this;
          },
        } as unknown as import("express").Response;
        app.handle(mockReq, mockRes, () => resolve({ status: 404, body: { message: "Not Found" } }));
      });
      expect(res.status).toBe(400);
      expect(storage.getLaps).not.toHaveBeenCalled();
    });
  });

  // ── GET /api/laps/best ───────────────────────────────────────────────────
  describe("GET /api/laps/best", () => {
    it("возвращает 200 и вызывает storage.getBestLaps", async () => {
      const res = await makeRequest(app, "GET", "/api/laps/best");
      expect(res.status).toBe(200);
      expect(storage.getBestLaps).toHaveBeenCalled();
    });
  });

  // ── GET /api/sessions ────────────────────────────────────────────────────
  describe("GET /api/sessions", () => {
    it("возвращает 200", async () => {
      const res = await makeRequest(app, "GET", "/api/sessions");
      expect(res.status).toBe(200);
    });

    it("вызывает storage.getSessions()", async () => {
      await makeRequest(app, "GET", "/api/sessions");
      expect(storage.getSessions).toHaveBeenCalled();
    });
  });

  // ── GET /api/sessions/:id ────────────────────────────────────────────────
  describe("GET /api/sessions/:id", () => {
    it("возвращает 404 если сессия не найдена", async () => {
      (storage.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, "GET", "/api/sessions/999");
      expect(res.status).toBe(404);
    });

    it("возвращает сессию если нашли", async () => {
      const mockSession = {
        id: 1,
        trackId: 1,
        event: "6 Hours of Le Mans",
        sessionType: "Race",
        venue: "Le Mans",
        dateTime: "2026-07-14T15:00:00.000Z",
        fileName: "race.xml",
        driverCount: 30,
        lapCount: 600,
      };
      (storage.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);
      const res = await makeRequest(app, "GET", "/api/sessions/1");
      expect(res.status).toBe(200);
      expect((res.body as typeof mockSession).event).toBe("6 Hours of Le Mans");
    });
  });

  // ── GET /api/sessions/:id/laps ───────────────────────────────────────────
  // #126: роут больше не собирает driverName/carNumber/isPlayer вручную через
  // 3 запроса + Map — делегирует storage.getSessionLapsEnriched() (один JOIN).
  describe("GET /api/sessions/:id/laps", () => {
    it("возвращает 400 для нечислового id, не вызывая storage.getSessionLapsEnriched", async () => {
      const res = await makeRequest(app, "GET", "/api/sessions/abc/laps");
      expect(res.status).toBe(400);
      expect(storage.getSessionLapsEnriched).not.toHaveBeenCalled();
    });

    it("передаёт id сессии как число в storage.getSessionLapsEnriched", async () => {
      await makeRequest(app, "GET", "/api/sessions/7/laps");
      expect(storage.getSessionLapsEnriched).toHaveBeenCalledWith(7);
    });

    it("возвращает круги из storage как есть", async () => {
      const mockLaps = [
        {
          id: 1,
          sessionId: 7,
          driverId: 3,
          lapNum: 1,
          lapNumber: 1,
          lapTimeMs: 95000,
          lapTimeSeconds: 95,
          isPitLap: false,
          driverName: "Пилот А",
          carNumber: "24",
          isPlayer: 1,
        },
      ];
      (storage.getSessionLapsEnriched as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockLaps);
      const res = await makeRequest(app, "GET", "/api/sessions/7/laps");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockLaps);
    });
  });

  // ── POST /api/import ──────────────────────────────────────────────────────
  // Синхронный импорт: роут вызывает runImport() напрямую и ждёт результат
  // (комментарий в routes.ts — PostgreSQL транзакция для типового файла
  // укладывается в <500мс, поэтому очередь не нужна). Idempotency (#6)
  // проверяется через прямой SELECT по import_jobs.file_hash.
  // ---------------------------------------------------------------------------
  describe("POST /api/import", () => {
    it("возвращает 400 если files не передан", async () => {
      const res = await makeRequest(app, "POST", "/api/import", {});
      expect(res.status).toBe(400);
    });

    it("возвращает 400 для пустого массива files", async () => {
      const res = await makeRequest(app, "POST", "/api/import", { files: [] });
      expect(res.status).toBe(400);
    });

    it("возвращает 200 и imported=1 при корректном файле", async () => {
      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "test.xml", content: "<rFactorXML>valid</rFactorXML>" }],
      });
      expect(res.status).toBe(200);
      const body = res.body as { imported: number; total: number; results: unknown[] };
      expect(body.imported).toBe(1);
      expect(body.total).toBe(1);
      expect(Array.isArray(body.results)).toBe(true);
    });

    it("результат содержит importId и sessionId для импортированного файла", async () => {
      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "test.xml", content: "<rFactorXML>valid</rFactorXML>" }],
      });
      const results = (res.body as { results: { importId: string; sessionId: number; ok: boolean }[] }).results;
      expect(results[0].ok).toBe(true);
      expect(results[0].importId).toBe("mock-job-id");
      expect(results[0].sessionId).toBe(1);
    });

    // Контракт per-file результата (#122 follow-up): `ok` теперь означает
    // ИСКЛЮЧИТЕЛЬНО "данные реально записаны", а `skipped` — единственный
    // надёжный дискриминатор пропуска (пустой файл / дубликат / 0 кругов).
    // Раньше ZERO_LAPS отдавался с ok=true, из-за чего клиент (проверявший
    // `r.ok` раньше `r.skipped`) путал пропуск с успешным импортом.
    it("пустой content возвращает ok=false, skipped=true и status=409", async () => {
      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "empty.xml", content: "" }],
      });
      const results = (res.body as { results: { ok: boolean; skipped: boolean; status: number }[] }).results;
      expect(results[0].ok).toBe(false);
      expect(results[0].skipped).toBe(true);
      expect(results[0].status).toBe(409);
    });

    it("дублирующий файл (уже есть в import_jobs) возвращает ok=false, skipped=true и status=409", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(chain([{ id: "existing-id", status: "completed" }]));

      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "dup.xml", content: "<rFactorXML>dup</rFactorXML>" }],
      });
      const results = (
        res.body as {
          results: { ok: boolean; skipped: boolean; status: number; importId: string; importStatus: string }[];
        }
      ).results;
      expect(results[0].ok).toBe(false);
      expect(results[0].skipped).toBe(true);
      expect(results[0].status).toBe(409);
      expect(results[0].importId).toBe("existing-id");
      expect(results[0].importStatus).toBe("completed");
    });

    // fix: раньше ЛЮБАЯ существующая строка с тем же file_hash (включая
    // failed) считалась дубликатом — файл, чей импорт однажды упал, больше
    // никогда не мог быть загружен повторно (fileHash уникален навсегда).
    it("файл с прошлой FAILED попыткой — НЕ дубликат, импорт повторяется с тем же id", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(chain([{ id: "failed-job-id", status: "failed" }]));

      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "retry.xml", content: "<rFactorXML>retry</rFactorXML>" }],
      });

      expect(res.status).toBe(200);
      const results = (res.body as { results: { ok: boolean; skipped: boolean; importId: string }[] }).results;
      expect(results[0].ok).toBe(true);
      expect(results[0].skipped).toBe(false);
      expect(results[0].importId).toBe("failed-job-id");
      expect(importWorker.runImport).toHaveBeenCalledWith(expect.objectContaining({ id: "failed-job-id" }));
      // Переиспользуем строку через UPDATE, а не создаём вторую с тем же fileHash.
      expect(db.update).toHaveBeenCalled();
    });

    it("произвольная ошибка runImport возвращает ok=false, skipped=false и status=500", async () => {
      (importWorker.runImport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("internal error"));
      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "bad.xml", content: "<rFactorXML>bad</rFactorXML>" }],
      });
      const results = (res.body as { results: { ok: boolean; skipped: boolean; status: number; message: string }[] })
        .results;
      expect(results[0].ok).toBe(false);
      expect(results[0].skipped).toBe(false);
      expect(results[0].status).toBe(500);
      expect(results[0].message).toBe("internal error");
    });

    it("imported=0 и статус 400 если все файлы упали с ошибкой", async () => {
      (importWorker.runImport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("err"));
      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "x.xml", content: "<rFactorXML>x</rFactorXML>" }],
      });
      expect(res.status).toBe(400);
      const body = res.body as { imported: number };
      expect(body.imported).toBe(0);
    });

    it("файл с 0 кругов (ZERO_LAPS) помечается как пропущенный (ok=false, skipped=true), а не ошибка", async () => {
      const zeroLapsErr = new Error("Файл пропущен: 0 кругов") as Error & { code?: string };
      zeroLapsErr.code = "ZERO_LAPS";
      (importWorker.runImport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(zeroLapsErr);

      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "nolaps.xml", content: "<rFactorXML>nolaps</rFactorXML>" }],
      });
      expect(res.status).toBe(200);
      const results = (res.body as { results: { ok: boolean; skipped: boolean; status: number; message: string }[] })
        .results;
      expect(results[0].ok).toBe(false);
      expect(results[0].skipped).toBe(true);
      expect(results[0].status).toBe(200);
      expect(results[0].message).toBe("Файл пропущен: 0 кругов");
    });

    it("успешный импорт возвращает ok=true, skipped=false и данные сессии (event/venue/sessionType/drivers) для журнала", async () => {
      (importWorker.runImport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        sessionId: 42,
        totalLaps: 20,
        validLaps: 18,
        errorLaps: 2,
        event: "Rolex 6 Hours Of Sao Paulo",
        venue: "Interlagos",
        sessionType: "Практика (Practice1)",
        driverCount: 19,
      });

      const res = await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "ok.xml", content: "<rFactorXML>ok</rFactorXML>" }],
      });
      const results = (res.body as { results: any[] }).results;
      expect(results[0].ok).toBe(true);
      expect(results[0].skipped).toBe(false);
      expect(results[0].event).toBe("Rolex 6 Hours Of Sao Paulo");
      expect(results[0].venue).toBe("Interlagos");
      expect(results[0].sessionType).toBe("Практика (Practice1)");
      expect(results[0].drivers).toBe(19);
      expect(results[0].laps).toBe(18);
    });

    it("вызывает runImport с правильными аргументами", async () => {
      await makeRequest(app, "POST", "/api/import", {
        files: [{ fileName: "race.xml", content: "<rFactorXML>data</rFactorXML>" }],
      });
      expect(importWorker.runImport).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "race.xml",
          content: "<rFactorXML>data</rFactorXML>",
        }),
      );
    });
  });

  // ── GET /api/import/:id/status ────────────────────────────────────────────
  // Polling статуса задачи (#5)
  // ---------------------------------------------------------------------------
  describe("GET /api/import/:id/status", () => {
    it("возвращает 404 если задача не найдена", async () => {
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);
      const res = await makeRequest(app, "GET", "/api/import/nonexistent/status");
      expect(res.status).toBe(404);
    });

    it("возвращает статус задачи", async () => {
      const mockJob = {
        id: "abc123",
        fileName: "race.xml",
        status: "completed",
        sessionId: 1,
        totalLaps: 42,
        validLaps: 40,
        errorLaps: 2,
        error: null,
        createdAt: Date.now(),
        finishedAt: Date.now(),
      };
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockJob);
      const res = await makeRequest(app, "GET", "/api/import/abc123/status");
      expect(res.status).toBe(200);
      const body = res.body as typeof mockJob;
      expect(body.importId).toBe("abc123");
      expect(body.status).toBe("completed");
      expect(body.totalLaps).toBe(42);
    });

    it("ответ содержит все обязательные поля", async () => {
      const mockJob = {
        id: "job1",
        fileName: "f.xml",
        status: "queued",
        sessionId: null,
        totalLaps: null,
        validLaps: null,
        errorLaps: null,
        error: null,
        createdAt: Date.now(),
        finishedAt: null,
      };
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockJob);
      const res = await makeRequest(app, "GET", "/api/import/job1/status");
      const body = res.body as Record<string, unknown>;
      expect(body).toHaveProperty("importId");
      expect(body).toHaveProperty("fileName");
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("sessionId");
      expect(body).toHaveProperty("totalLaps");
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("createdAt");
      expect(body).toHaveProperty("finishedAt");
    });
  });

  // ── GET /api/import/:id/errors ────────────────────────────────────────────
  // DLQ просмотр ошибок импорта (#8)
  // ---------------------------------------------------------------------------
  describe("GET /api/import/:id/errors", () => {
    it("возвращает 404 если задача не найдена", async () => {
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);
      const res = await makeRequest(app, "GET", "/api/import/nonexistent/errors");
      expect(res.status).toBe(404);
    });

    it("возвращает пустой список ошибок если их нет", async () => {
      const mockJob = { id: "j1", fileName: "f.xml", status: "completed" };
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockJob);
      (importWorker.getJobErrors as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
      const res = await makeRequest(app, "GET", "/api/import/j1/errors");
      expect(res.status).toBe(200);
      const body = res.body as { totalErrors: number; errors: unknown[] };
      expect(body.totalErrors).toBe(0);
      expect(body.errors).toEqual([]);
    });

    it("возвращает список DLQ ошибок", async () => {
      const mockJob = { id: "j2", fileName: "f.xml", status: "completed" };
      const mockErrors = [
        {
          id: 1,
          importJobId: "j2",
          rawPayload: "{}",
          errorCode: "LAP_TOO_FAST",
          errorMessage: "too fast",
          occurredAt: Date.now(),
        },
        {
          id: 2,
          importJobId: "j2",
          rawPayload: "{}",
          errorCode: "LAP_TOO_SLOW",
          errorMessage: "too slow",
          occurredAt: Date.now(),
        },
      ];
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockJob);
      (importWorker.getJobErrors as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockErrors);
      const res = await makeRequest(app, "GET", "/api/import/j2/errors");
      expect(res.status).toBe(200);
      const body = res.body as { totalErrors: number; errors: typeof mockErrors };
      expect(body.totalErrors).toBe(2);
      expect(body.errors[0].errorCode).toBe("LAP_TOO_FAST");
    });

    it("ответ содержит importId и fileName", async () => {
      const mockJob = { id: "j3", fileName: "race.xml", status: "failed" };
      (importWorker.getJobStatus as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockJob);
      const res = await makeRequest(app, "GET", "/api/import/j3/errors");
      const body = res.body as Record<string, unknown>;
      expect(body).toHaveProperty("importId", "j3");
      expect(body).toHaveProperty("fileName", "race.xml");
    });
  });

  // ── Admin auth (issue #122) ───────────────────────────────────────────────
  describe("Admin-защита деструктивных роутов", () => {
    const protectedRoutes = ["/api/import/all", "/api/import/telemetry/all"];

    for (const path of protectedRoutes) {
      it(`DELETE ${path} возвращает 401 без токена`, async () => {
        const res = await makeRequest(app, "DELETE", path);
        expect(res.status).toBe(401);
      });

      it(`DELETE ${path} возвращает 401 с неверным токеном`, async () => {
        const res = await makeRequest(app, "DELETE", path, undefined, { authorization: "Bearer wrong-token" });
        expect(res.status).toBe(401);
      });
    }

    it("возвращает 503, если ADMIN_TOKEN не настроен на сервере", async () => {
      delete process.env.ADMIN_TOKEN;
      try {
        const res = await makeRequest(app, "DELETE", "/api/import/all", undefined, authHeader);
        expect(res.status).toBe(503);
      } finally {
        process.env.ADMIN_TOKEN = TEST_ADMIN_TOKEN;
      }
    });
  });

  // ── GET /api/special-events ───────────────────────────────────────────────
  describe("GET /api/special-events", () => {
    it("возвращает 200", async () => {
      const res = await makeRequest(app, "GET", "/api/special-events");
      expect(res.status).toBe(200);
    });

    it("тело ответа содержит поле events", async () => {
      const res = await makeRequest(app, "GET", "/api/special-events");
      expect(res.body).toHaveProperty("events");
    });

    it("events — массив", async () => {
      const res = await makeRequest(app, "GET", "/api/special-events");
      expect(Array.isArray((res.body as { events: unknown[] }).events)).toBe(true);
    });
  });

  // ── POST /api/special-events/refresh ─────────────────────────────────────
  describe("POST /api/special-events/refresh", () => {
    it("возвращает 200 с ok=true", async () => {
      const res = await makeRequest(app, "POST", "/api/special-events/refresh");
      expect(res.status).toBe(200);
      expect((res.body as { ok: boolean }).ok).toBe(true);
    });

    it("вызывает invalidateCache()", async () => {
      const { invalidateCache } = await import("../server/eventsParser");
      await makeRequest(app, "POST", "/api/special-events/refresh");
      expect(invalidateCache).toHaveBeenCalled();
    });
  });
});

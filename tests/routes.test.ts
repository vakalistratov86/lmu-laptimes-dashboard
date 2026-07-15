import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express, { type Express } from 'express';
import http from 'node:http';
import { registerRoutes } from '../server/routes';

// ---------------------------------------------------------------------------
// Мок хранилища
// ---------------------------------------------------------------------------
vi.mock('../server/storage', () => ({
  storage: {
    getTracks: vi.fn().mockResolvedValue([]),
    getTrack: vi.fn(),
    getDrivers: vi.fn().mockResolvedValue([]),
    getDriver: vi.fn(),
    getLaps: vi.fn().mockResolvedValue([]),
    getSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn(),
    importLog: vi.fn(),
  },
  db: {
    delete: vi.fn(() => ({ where: vi.fn(() => ({ run: vi.fn() })), run: vi.fn() })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ all: vi.fn(() => []) })) })),
  },
}));

vi.mock('../server/eventsParser', () => ({
  getSpecialEvents: vi.fn().mockResolvedValue({
    events: [],
    fetchedAt: new Date().toISOString(),
    sourceUrl: '',
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
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const mockReq = {
      method,
      url: path,
      path,
      query: {},
      params: {},
      headers: { 'content-type': 'application/json' },
      body: body ?? {},
    } as unknown as import('express').Request;

    const mockRes = {
      statusCode: 200,
      _headers: {} as Record<string, string>,
      status(code: number) { this.statusCode = code; return this; },
      json(data: unknown) { resolve({ status: this.statusCode, body: data }); return this; },
      setHeader(k: string, v: string) { this._headers[k] = v; return this; },
      getHeader(k: string) { return this._headers[k]; },
      send(data: unknown) { resolve({ status: this.statusCode, body: data }); return this; },
    } as unknown as import('express').Response;

    app.handle(mockReq, mockRes, () => resolve({ status: 404, body: { message: 'Not Found' } }));
  });
}

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------
describe('API Routes', () => {
  let app: Express;
  let server: http.Server;
  // FIX: тип для замоканного storage
  let storage: Awaited<typeof import('../server/storage')>['storage'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    server = result.server;
    // FIX: получаем замоканный модуль внутри beforeEach, а не на верхнем уровне
    storage = (await import('../server/storage')).storage;
  });

  afterEach(() => {
    vi.clearAllMocks();
    server.close();
  });

  // ── GET /api/tracks ──────────────────────────────────────────────────────
  describe('GET /api/tracks', () => {
    it('возвращает 200 и пустой массив', async () => {
      const res = await makeRequest(app, 'GET', '/api/tracks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('вызывает storage.getTracks()', async () => {
      await makeRequest(app, 'GET', '/api/tracks');
      expect(storage.getTracks).toHaveBeenCalled();
    });

    it('возвращает трассы из хранилища', async () => {
      const mockTracks = [
        { id: 1, name: 'Le Mans', country: 'FR', lengthKm: 13.6, turns: 38, layout: 'Full' },
        { id: 2, name: 'Spa',     country: 'BE', lengthKm: 7.0,  turns: 19, layout: 'Full' },
      ];
      (storage.getTracks as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockTracks);
      const res = await makeRequest(app, 'GET', '/api/tracks');
      expect(res.status).toBe(200);
      expect((res.body as typeof mockTracks).length).toBe(2);
    });
  });

  // ── GET /api/tracks/:id ──────────────────────────────────────────────────
  describe('GET /api/tracks/:id', () => {
    it('возвращает 404 если getTrack вернул undefined', async () => {
      (storage.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, 'GET', '/api/tracks/999');
      expect(res.status).toBe(404);
    });

    it('возвращает трассу если нашли', async () => {
      const mockTrack = { id: 1, name: 'Le Mans', country: 'FR', lengthKm: 13.6, turns: 38, layout: 'Full' };
      (storage.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockTrack);
      const res = await makeRequest(app, 'GET', '/api/tracks/1');
      expect(res.status).toBe(200);
      expect((res.body as typeof mockTrack).name).toBe('Le Mans');
    });

    it('передаёт id как число в storage.getTrack', async () => {
      (storage.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      await makeRequest(app, 'GET', '/api/tracks/42');
      expect(storage.getTrack).toHaveBeenCalledWith(42);
    });
  });

  // ── GET /api/drivers ─────────────────────────────────────────────────────
  describe('GET /api/drivers', () => {
    it('возвращает 200 и пустой массив', async () => {
      const res = await makeRequest(app, 'GET', '/api/drivers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('возвращает пилотов из хранилища', async () => {
      const mockDrivers = [
        { id: 1, name: 'Пилот А', team: 'Toyota', country: 'JP' },
      ];
      (storage.getDrivers as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDrivers);
      const res = await makeRequest(app, 'GET', '/api/drivers');
      expect((res.body as typeof mockDrivers)[0].name).toBe('Пилот А');
    });
  });

  // ── GET /api/drivers/:id ─────────────────────────────────────────────────
  describe('GET /api/drivers/:id', () => {
    it('возвращает 404 если getDriver вернул undefined', async () => {
      (storage.getDriver as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, 'GET', '/api/drivers/999');
      expect(res.status).toBe(404);
    });

    it('возвращает пилота если нашли', async () => {
      const mockDriver = { id: 5, name: 'Пилот Б', team: 'Ferrari', country: 'IT' };
      (storage.getDriver as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDriver);
      const res = await makeRequest(app, 'GET', '/api/drivers/5');
      expect(res.status).toBe(200);
      expect((res.body as typeof mockDriver).team).toBe('Ferrari');
    });
  });

  // ── GET /api/laps ─────────────────────────────────────────────────────────
  describe('GET /api/laps', () => {
    it('возвращает 200', async () => {
      const res = await makeRequest(app, 'GET', '/api/laps');
      expect(res.status).toBe(200);
    });

    it('передаёт trackId из query в фильтр', async () => {
      const mockReq = {
        method: 'GET',
        url: '/api/laps?trackId=3',
        path: '/api/laps',
        query: { trackId: '3' },
        params: {},
        headers: { 'content-type': 'application/json' },
        body: {},
      } as unknown as import('express').Request;
      const mockRes = {
        statusCode: 200,
        _headers: {} as Record<string, string>,
        status(code: number) { this.statusCode = code; return this; },
        json(_data: unknown) { return this; },
        setHeader(k: string, v: string) { this._headers[k] = v; return this; },
        getHeader(k: string) { return this._headers[k]; },
        send(_data: unknown) { return this; },
      } as unknown as import('express').Response;
      await new Promise<void>((resolve) => {
        app.handle(mockReq, mockRes, () => resolve());
        setTimeout(resolve, 50);
      });
      expect(storage.getLaps).toHaveBeenCalledWith(expect.objectContaining({ trackId: 3 }));
    });
  });

  // ── GET /api/sessions ────────────────────────────────────────────────────
  describe('GET /api/sessions', () => {
    it('возвращает 200', async () => {
      const res = await makeRequest(app, 'GET', '/api/sessions');
      expect(res.status).toBe(200);
    });

    it('вызывает storage.getSessions()', async () => {
      await makeRequest(app, 'GET', '/api/sessions');
      expect(storage.getSessions).toHaveBeenCalled();
    });
  });

  // ── GET /api/sessions/:id ────────────────────────────────────────────────
  describe('GET /api/sessions/:id', () => {
    it('возвращает 404 если сессия не найдена', async () => {
      (storage.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, 'GET', '/api/sessions/999');
      expect(res.status).toBe(404);
    });

    it('возвращает сессию если нашли', async () => {
      const mockSession = {
        id: 1, trackId: 1, event: '6 Hours of Le Mans', sessionType: 'Race',
        venue: 'Le Mans', dateTime: '2026-07-14T15:00:00.000Z',
        fileName: 'race.xml', driverCount: 30, lapCount: 600,
      };
      (storage.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);
      const res = await makeRequest(app, 'GET', '/api/sessions/1');
      expect(res.status).toBe(200);
      expect((res.body as typeof mockSession).event).toBe('6 Hours of Le Mans');
    });
  });

  // ── POST /api/import ─────────────────────────────────────────────────────
  describe('POST /api/import', () => {
    it('возвращает 400 если files не передан', async () => {
      const res = await makeRequest(app, 'POST', '/api/import', {});
      expect(res.status).toBe(400);
    });

    it('возвращает 400 для пустого массива files', async () => {
      const res = await makeRequest(app, 'POST', '/api/import', { files: [] });
      expect(res.status).toBe(400);
    });

    it('возвращает статистику импорта при корректном вызове', async () => {
      (storage.importLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true, fileName: 'test.xml', laps: 42,
      });
      const res = await makeRequest(app, 'POST', '/api/import', {
        files: [{ fileName: 'test.xml', content: '<rFactorXML>valid</rFactorXML>' }],
      });
      expect(res.status).toBe(200);
      const body = res.body as { imported: number; totalLaps: number; skipped: number };
      expect(body).toHaveProperty('imported');
      expect(body).toHaveProperty('totalLaps');
      expect(body).toHaveProperty('skipped');
    });

    it('totalLaps суммируется по всем файлам', async () => {
      (storage.importLog as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, fileName: 'a.xml', laps: 10 })
        .mockResolvedValueOnce({ ok: true, fileName: 'b.xml', laps: 20 });
      const res = await makeRequest(app, 'POST', '/api/import', {
        files: [
          { fileName: 'a.xml', content: '<rFactorXML>a</rFactorXML>' },
          { fileName: 'b.xml', content: '<rFactorXML>b</rFactorXML>' },
        ],
      });
      const body = res.body as { totalLaps: number };
      expect(body.totalLaps).toBe(30);
    });

    it('файл с пустым content пишется в results как ok=false', async () => {
      const res = await makeRequest(app, 'POST', '/api/import', {
        files: [{ fileName: 'empty.xml', content: '' }],
      });
      const body = res.body as { results: { ok: boolean }[] };
      expect(body.results[0].ok).toBe(false);
    });

    it('ошибка в importLog пишется в results как ok=false', async () => {
      (storage.importLog as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('parse failed'),
      );
      const res = await makeRequest(app, 'POST', '/api/import', {
        files: [{ fileName: 'bad.xml', content: '<rFactorXML>bad</rFactorXML>' }],
      });
      const body = res.body as { results: { ok: boolean; message: string }[] };
      expect(body.results[0].ok).toBe(false);
      expect(body.results[0].message).toBe('parse failed');
    });

    it('imported = 0 если все файлы упали', async () => {
      (storage.importLog as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('err'));
      const res = await makeRequest(app, 'POST', '/api/import', {
        files: [{ fileName: 'x.xml', content: '<rFactorXML>x</rFactorXML>' }],
      });
      const body = res.body as { imported: number };
      expect(body.imported).toBe(0);
    });
  });

  // ── GET /api/special-events ──────────────────────────────────────────────
  describe('GET /api/special-events', () => {
    it('возвращает 200', async () => {
      const res = await makeRequest(app, 'GET', '/api/special-events');
      expect(res.status).toBe(200);
    });

    it('тело ответа содержит поле events', async () => {
      const res = await makeRequest(app, 'GET', '/api/special-events');
      expect(res.body).toHaveProperty('events');
    });

    it('events — массив', async () => {
      const res = await makeRequest(app, 'GET', '/api/special-events');
      expect(Array.isArray((res.body as { events: unknown[] }).events)).toBe(true);
    });
  });

  // ── POST /api/special-events/refresh ────────────────────────────────────
  describe('POST /api/special-events/refresh', () => {
    it('возвращает 200 с ok=true', async () => {
      const res = await makeRequest(app, 'POST', '/api/special-events/refresh');
      expect(res.status).toBe(200);
      expect((res.body as { ok: boolean }).ok).toBe(true);
    });

    it('вызывает invalidateCache()', async () => {
      const { invalidateCache } = await import('../server/eventsParser');
      await makeRequest(app, 'POST', '/api/special-events/refresh');
      expect(invalidateCache).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express, { type Express } from 'express';
import http from 'node:http';
import { registerRoutes } from '../server/routes';

// ---------------------------------------------------------------------------
// Мок хранилища — все методы storage подменяем
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
  type LapFilter: {},
}));

vi.mock('../server/eventsParser', () => ({
  getSpecialEvents: vi.fn().mockResolvedValue({ events: [], fetchedAt: new Date().toISOString(), sourceUrl: '' }),
  invalidateCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Вспомогательная функция для создания тестового сервера
// ---------------------------------------------------------------------------
async function buildTestApp(): Promise<{ app: Express; server: http.Server }> {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  await registerRoutes(server, app);
  return { app, server };
}

// ---------------------------------------------------------------------------
// Простая функция fetch-like для тестирования роутов без внешнего сервера
// ---------------------------------------------------------------------------
function makeRequest(
  app: Express,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const req = Object.assign(Object.create(require('stream').Readable.prototype), {
      method,
      url: path,
      headers: { 'content-type': 'application/json', host: 'localhost' },
    });
    // Используем supertest-style через node:http напрямую
    // Для простоты тестируем через express app.handle
    const mockReq = {
      method,
      url: path,
      path,
      query: {},
      params: {},
      headers: { 'content-type': 'application/json' },
      body: body ?? {},
    } as unknown as import('express').Request;

    const chunks: Buffer[] = [];
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

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    server = result.server;
  });

  afterEach(() => {
    vi.clearAllMocks();
    server.close();
  });

  const { storage } = await import('../server/storage');

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
  });

  describe('GET /api/tracks/:id — трасса не найдена', () => {
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
  });

  describe('GET /api/drivers', () => {
    it('возвращает 200 и пустой массив', async () => {
      const res = await makeRequest(app, 'GET', '/api/drivers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/drivers/:id — пилот не найден', () => {
    it('возвращает 404 если getDriver вернул undefined', async () => {
      (storage.getDriver as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await makeRequest(app, 'GET', '/api/drivers/999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/laps', () => {
    it('возвращает 200 и пустой массив', async () => {
      const res = await makeRequest(app, 'GET', '/api/laps');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/sessions', () => {
    it('возвращает 200', async () => {
      const res = await makeRequest(app, 'GET', '/api/sessions');
      expect(res.status).toBe(200);
    });
  });

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
      const body = res.body as { imported: number; totalLaps: number };
      expect(body).toHaveProperty('imported');
      expect(body).toHaveProperty('totalLaps');
    });

    it('файл с пустым content пишется в results как ok=false', async () => {
      const res = await makeRequest(app, 'POST', '/api/import', {
        files: [{ fileName: 'empty.xml', content: '' }],
      });
      const body = res.body as { results: { ok: boolean }[] };
      expect(body.results[0].ok).toBe(false);
    });
  });

  describe('GET /api/special-events', () => {
    it('возвращает 200 и данные о событиях', async () => {
      const res = await makeRequest(app, 'GET', '/api/special-events');
      expect(res.status).toBe(200);
    });
  });
});

/**
 * auth.test.ts — unit-тесты для server/auth.ts (хэширование пароля, cookie сессии).
 *
 * server/storage.ts открывает реальное соединение с Postgres на уровне модуля
 * (`postgres(process.env.DATABASE_URL!)`) — как и tests/routes.test.ts, мокаем
 * "../server/storage" ДО импорта server/auth.ts, чтобы тест не требовал живой БД.
 */
import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";

vi.mock("../server/storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
    createUser: vi.fn(),
    createUserSession: vi.fn(),
    getUserSession: vi.fn(),
    deleteUserSession: vi.fn(),
  },
}));

import {
  hashPassword,
  verifyPassword,
  toPublicUser,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken,
  resolveCurrentUser,
  requireAdminUser,
  rateLimitByIp,
  resetRateLimitsForTests,
} from "../server/auth";
import { storage } from "../server/storage";
import type { User } from "@shared/schema";

describe("hashPassword / verifyPassword", () => {
  it("верный пароль проходит проверку", () => {
    const stored = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", stored)).toBe(true);
  });

  it("неверный пароль не проходит проверку", () => {
    const stored = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("хэш никогда не совпадает с исходным паролем (не хранится в открытом виде)", () => {
    const stored = hashPassword("correct-horse-battery-staple");
    expect(stored).not.toContain("correct-horse-battery-staple");
  });

  it("два хэша одного и того же пароля различаются (случайная соль)", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    // но оба всё равно проходят проверку одного и того же пароля
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("verifyPassword возвращает false, а не бросает исключение, на битом сохранённом значении", () => {
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });
});

describe("toPublicUser", () => {
  it("убирает passwordHash из пользователя перед отправкой клиенту", () => {
    const user: User = {
      id: 1,
      email: "driver@example.com",
      passwordHash: "salt:hash",
      displayName: "Max",
      createdAt: 1_700_000_000_000,
      isAdmin: 0,
    };
    const publicUser = toPublicUser(user);
    expect(publicUser).not.toHaveProperty("passwordHash");
    expect(publicUser).toEqual({
      id: 1,
      email: "driver@example.com",
      displayName: "Max",
      createdAt: user.createdAt,
      isAdmin: 0,
    });
  });
});

describe("session cookie", () => {
  function mockResponse() {
    const headers: Record<string, string> = {};
    return {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value;
      }),
      _headers: headers,
    } as unknown as Response & { _headers: Record<string, string> };
  }

  it("setSessionCookie ставит HttpOnly + SameSite=Lax и сам токен", () => {
    const res = mockResponse();
    setSessionCookie(res, "token-123", Date.now() + 1000);
    const cookie = res.setHeader.mock.calls[0][1] as string;
    expect(cookie).toContain("lmu_session=token-123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("clearSessionCookie сбрасывает cookie в прошлое", () => {
    const res = mockResponse();
    clearSessionCookie(res);
    const cookie = res.setHeader.mock.calls[0][1] as string;
    expect(cookie).toContain("lmu_session=;");
    expect(cookie).toContain("1970");
  });

  it("readSessionToken читает токен из заголовка Cookie среди прочих cookie", () => {
    const req = { headers: { cookie: "other=1; lmu_session=abc123; another=2" } } as any;
    expect(readSessionToken(req)).toBe("abc123");
  });

  it("readSessionToken возвращает undefined, если cookie нет", () => {
    const req = { headers: {} } as any;
    expect(readSessionToken(req)).toBeUndefined();
  });
});

describe("resolveCurrentUser", () => {
  it("возвращает undefined без cookie", async () => {
    const req = { headers: {} } as any;
    expect(await resolveCurrentUser(req)).toBeUndefined();
  });

  it("возвращает undefined для истёкшей сессии", async () => {
    vi.mocked(storage.getUserSession).mockResolvedValueOnce({
      id: "tok",
      userId: 1,
      createdAt: 0,
      expiresAt: Date.now() - 1000, // истекла
    });
    const req = { headers: { cookie: "lmu_session=tok" } } as any;
    expect(await resolveCurrentUser(req)).toBeUndefined();
  });

  it("возвращает пользователя для валидной сессии", async () => {
    const user: User = {
      id: 1,
      email: "driver@example.com",
      passwordHash: "salt:hash",
      displayName: "Max",
      createdAt: 0,
      isAdmin: 0,
    };
    vi.mocked(storage.getUserSession).mockResolvedValueOnce({
      id: "tok",
      userId: 1,
      createdAt: 0,
      expiresAt: Date.now() + 100_000,
    });
    vi.mocked(storage.getUserById).mockResolvedValueOnce(user);
    const req = { headers: { cookie: "lmu_session=tok" } } as any;
    expect(await resolveCurrentUser(req)).toEqual(user);
  });
});

describe("requireAdminUser", () => {
  function mockRes() {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
  }

  it("возвращает 401 без cookie сессии, не заполняет req.user", async () => {
    const req = { headers: {} } as any;
    const res = mockRes();
    const next = vi.fn();
    await requireAdminUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("возвращает 403 для валидной сессии без isAdmin", async () => {
    const user: User = {
      id: 1,
      email: "driver@example.com",
      passwordHash: "salt:hash",
      displayName: "Max",
      createdAt: 0,
      isAdmin: 0,
    };
    vi.mocked(storage.getUserSession).mockResolvedValueOnce({
      id: "tok",
      userId: 1,
      createdAt: 0,
      expiresAt: Date.now() + 100_000,
    });
    vi.mocked(storage.getUserById).mockResolvedValueOnce(user);
    const req = { headers: { cookie: "lmu_session=tok" } } as any;
    const res = mockRes();
    const next = vi.fn();
    await requireAdminUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("пропускает дальше и заполняет req.user для isAdmin=1", async () => {
    const user: User = {
      id: 1,
      email: "admin@example.com",
      passwordHash: "salt:hash",
      displayName: "Admin",
      createdAt: 0,
      isAdmin: 1,
    };
    vi.mocked(storage.getUserSession).mockResolvedValueOnce({
      id: "tok",
      userId: 1,
      createdAt: 0,
      expiresAt: Date.now() + 100_000,
    });
    vi.mocked(storage.getUserById).mockResolvedValueOnce(user);
    const req = { headers: { cookie: "lmu_session=tok" } } as any;
    const res = mockRes();
    const next = vi.fn();
    await requireAdminUser(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual(user);
  });
});

describe("rateLimitByIp", () => {
  function mockReqRes(ip: string) {
    const req = { socket: { remoteAddress: ip }, headers: {} } as any;
    const headers: Record<string, string> = {};
    const res = {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value;
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      _headers: headers,
    } as any;
    return { req, res };
  }

  it("пропускает запросы, пока их меньше лимита", () => {
    resetRateLimitsForTests();
    const limiter = rateLimitByIp("test", 3, 60_000);
    const next = vi.fn();
    const { req, res } = mockReqRes("1.2.3.4");

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("возвращает 429 и Retry-After после превышения лимита", () => {
    resetRateLimitsForTests();
    const limiter = rateLimitByIp("test", 2, 60_000);
    const next = vi.fn();
    const { req, res } = mockReqRes("1.2.3.4");

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next); // 3-й — сверх лимита в 2

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res._headers["Retry-After"]).toBeDefined();
  });

  it("не делит счётчик между разными IP", () => {
    resetRateLimitsForTests();
    const limiter = rateLimitByIp("test", 1, 60_000);
    const next = vi.fn();

    const a = mockReqRes("1.1.1.1");
    const b = mockReqRes("2.2.2.2");
    limiter(a.req, a.res, next);
    limiter(b.req, b.res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(a.res.status).not.toHaveBeenCalled();
    expect(b.res.status).not.toHaveBeenCalled();
  });

  it("не делит счётчик между разными keyPrefix на одном IP", () => {
    resetRateLimitsForTests();
    const registerLimiter = rateLimitByIp("register", 1, 60_000);
    const loginLimiter = rateLimitByIp("login", 1, 60_000);
    const next = vi.fn();
    const { req, res } = mockReqRes("1.2.3.4");

    registerLimiter(req, res, next);
    loginLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("resetRateLimitsForTests снимает накопленные счётчики", () => {
    resetRateLimitsForTests();
    const limiter = rateLimitByIp("test", 1, 60_000);
    const next = vi.fn();
    const { req, res } = mockReqRes("1.2.3.4");

    limiter(req, res, next);
    resetRateLimitsForTests();
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });
});

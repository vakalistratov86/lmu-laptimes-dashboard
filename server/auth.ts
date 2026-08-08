import type { Request, Response, NextFunction } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { storage } from "./storage";
import type { PublicUser, User } from "@shared/schema";

const SESSION_COOKIE = "lmu_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

// ── Пароли: scrypt (встроен в node:crypto, без внешней зависимости) ────────
// Формат хранения — "saltHex:hashHex", как в официальном примере Node.js docs.

export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

// ── Сессии входа: случайный токен в httpOnly-cookie, хранится в user_sessions ──
// Не JWT: строка удаляется из БД при logout — сессия отзывается мгновенно,
// без чёрного списка токенов.

export async function createUserSession(userId: number): Promise<{ token: string; expiresAt: number }> {
  const token = randomUUID() + randomBytes(24).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await storage.createUserSession({ id: token, userId, createdAt: now, expiresAt });
  return { token, expiresAt };
}

// ── Cookie: без express/cookie-parser — формат ответа минимальный, парсим сами ──

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function setSessionCookie(res: Response, token: string, expiresAt: number): void {
  const isProd = process.env.NODE_ENV === "production";
  const expires = new Date(expiresAt).toUTCString();
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expires}`,
  ];
  if (isProd) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  const attrs = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"];
  if (isProd) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function readSessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

/**
 * Резолвит текущего пользователя по cookie-токену: undefined, если cookie
 * нет, сессия не найдена или истекла (истёкшая сессия не удаляется активно —
 * это делает не блокирующая GC-подобная зачистка на регистрации/логине,
 * лишняя DELETE на каждый read-запрос не нужна).
 */
export async function resolveCurrentUser(req: Request): Promise<User | undefined> {
  const token = readSessionToken(req);
  if (!token) return undefined;

  const session = await storage.getUserSession(token);
  if (!session || session.expiresAt < Date.now()) return undefined;

  return storage.getUserById(session.userId);
}

/** Middleware для роутов, требующих входа: 401 без валидной сессии, иначе req.user заполнен. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await resolveCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: "Требуется вход в систему" });
    return;
  }
  req.user = user;
  next();
}

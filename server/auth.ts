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

/**
 * Middleware для страницы администратора (список пользователей, статистика
 * загрузок, размер БД, удаление сессий): 401 без валидной сессии входа, 403
 * для залогиненного, но не-админского пользователя, иначе req.user заполнен.
 * Роль назначается только через POST /api/admin/promote (server/adminAuth.ts,
 * requireAdminToken) — обычная регистрация не может выставить isAdmin сама себе.
 */
export async function requireAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await resolveCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: "Требуется вход в систему" });
    return;
  }
  if (!user.isAdmin) {
    res.status(403).json({ message: "Требуются права администратора" });
    return;
  }
  req.user = user;
  next();
}

// ── Rate limiting на /api/auth/*: без внешней зависимости, in-memory, по IP ──
// scrypt намеренно CPU/memory-hard (это и есть защита пароля от перебора) —
// без лимита на сам HTTP-эндпоинт это же свойство превращает login/register
// в дешёвый DoS-вектор против самого сервера, особенно на маленькой VM.
// Single-instance процесс (нет кластера/нескольких реплик за балансировщиком)
// — состояние в памяти одного процесса корректно отражает реальные попытки.

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let requestsSinceSweep = 0;

/** Только для тестов: сбрасывает счётчики между кейсами, чтобы они не зависели от порядка/количества предыдущих запросов в файле. */
export function resetRateLimitsForTests(): void {
  rateLimitBuckets.clear();
  requestsSinceSweep = 0;
}

/** Периодическая чистка устаревших записей — не даёт Map расти неограниченно от IP, которые больше не приходят. */
function sweepExpiredBuckets(windowMs: number, now: number): void {
  requestsSinceSweep++;
  if (requestsSinceSweep < 200) return;
  requestsSinceSweep = 0;
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.windowStart > windowMs) rateLimitBuckets.delete(key);
  }
}

/**
 * IP клиента: X-Real-IP, если есть, иначе прямой TCP-пир.
 *
 * Прод стоит за nginx на том же хосте (proxy_pass http://127.0.0.1:3000,
 * nginx сам ставит X-Real-IP/X-Forwarded-For — конфиг вне репозитория, живёт
 * на сервере) — контейнер видит входящее соединение не от реального клиента,
 * а от docker-proxy/бридж-шлюза, так что req.socket.remoteAddress для ВСЕГО
 * прод-трафика был бы одним и тем же адресом, а не адресом клиента. Порт
 * приложения (3000/3001) наружу не проброшен файрволом — единственный
 * публичный вход это nginx на 80-м, и он именно ПЕРЕЗАПИСЫВАЕТ X-Real-IP
 * своим `$remote_addr`, а не пропускает клиентский заголовок как есть —
 * подделать его, обратившись напрямую к контейнеру, снаружи нельзя, поэтому
 * заголовку можно доверять безусловно.
 */
function getClientIp(req: Request): string {
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp) return xRealIp;
  return req.socket?.remoteAddress ?? "unknown";
}

/**
 * Fixed-window лимит попыток на IP: `max` запросов за `windowMs`, иначе 429.
 * `keyPrefix` разделяет счётчики /login и /register — не делят один лимит.
 */
export function rateLimitByIp(keyPrefix: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    sweepExpiredBuckets(windowMs, now);

    const key = `${keyPrefix}:${getClientIp(req)}`;
    const bucket = rateLimitBuckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      rateLimitBuckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ message: "Слишком много попыток, попробуйте позже" });
      return;
    }

    bucket.count++;
    next();
  };
}

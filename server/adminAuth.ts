import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

/** Сравнение строк за постоянное время — не даёт восстановить токен по задержке ответа. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Защищает деструктивные admin-роуты (полная очистка БД/демо-данных/телеметрии)
 * общим токеном из переменной окружения ADMIN_TOKEN.
 * Токен передаётся заголовком `Authorization: Bearer <token>`.
 *
 * Если ADMIN_TOKEN не задан на сервере, роут отвечает 503, а не пропускает
 * запрос — иначе забытая настройка молча оставляла бы эндпоинт открытым
 * для всех (issue #122).
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(503).json({ message: "Сервер не настроен: не задан ADMIN_TOKEN" });
    return;
  }

  // Читаем сырой заголовок напрямую, а не через req.header() — так middleware
  // работает одинаково и с настоящим Express Request, и с упрощёнными
  // моками в тестах, у которых есть только объект headers.
  const header = req.headers.authorization ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  const provided = match?.[1];

  if (!provided || !safeCompare(provided, expected)) {
    res.status(401).json({ message: "Неверный или отсутствующий admin-токен" });
    return;
  }

  next();
}

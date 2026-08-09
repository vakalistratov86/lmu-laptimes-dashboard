import type { DriverEnriched } from "@shared/schema";

/**
 * Единственный доступный способ связать аккаунт (users.displayName) с игровым
 * пилотом из логов (drivers.name) — сравнение имени, пока в схеме нет прямой
 * связи между таблицами (см. shared/schema.ts, комментарий у users).
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function isOwnDriverName(displayName: string | undefined, driverName: string | undefined): boolean {
  if (!displayName || !driverName) return false;
  return normalizeName(displayName) === normalizeName(driverName);
}

/** Пилот из списка, чьё имя совпадает с отображаемым именем пользователя (без учёта регистра/пробелов). */
export function findOwnDriver(
  displayName: string | undefined,
  drivers: DriverEnriched[] | undefined,
): DriverEnriched | undefined {
  if (!displayName || !drivers) return undefined;
  return drivers.find((d) => isOwnDriverName(displayName, d.name));
}

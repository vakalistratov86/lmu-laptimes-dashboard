const STORAGE_KEY = "lmu-admin-token";

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearStoredAdminToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Возвращает admin-токен для деструктивных запросов (очистка БД/телеметрии):
 * если уже сохранён в localStorage — берёт его, иначе один раз запрашивает
 * у пользователя через prompt() и сохраняет. Возвращает null, если пользователь
 * отменил ввод.
 */
export function promptAdminToken(message: string): string | null {
  const existing = getStoredAdminToken();
  if (existing) return existing;

  const entered = window.prompt(message)?.trim();
  if (!entered) return null;

  localStorage.setItem(STORAGE_KEY, entered);
  return entered;
}

/**
 * Общие примитивы IndexedDB для импортёров логов и телеметрии — обе панели
 * читают/пишут одну и ту же БД (lmu-import-db), раньше каждая держала свою
 * копию open/get/put. Ключ seen-сета параметризован префиксом: "" — логи,
 * "telemetry:" — телеметрия (сохраняет текущие on-disk ключи без миграции).
 */
export const DB_NAME = "lmu-import-db";
export const DB_VERSION = 1;
export const STORE_HANDLE = "dirHandle";
export const STORE_SEEN = "seenFiles";

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_HANDLE)) req.result.createObjectStore(STORE_HANDLE);
      if (!req.result.objectStoreNames.contains(STORE_SEEN)) req.result.createObjectStore(STORE_SEEN);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetSeenSet(prefix: string): Promise<Set<string>> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SEEN, "readonly");
    const req = tx.objectStore(STORE_SEEN).get(`${prefix}seen`);
    req.onsuccess = () => resolve(new Set<string>(req.result ?? []));
    req.onerror = () => resolve(new Set());
  });
}

export async function dbSaveSeenSet(set: Set<string>, prefix: string): Promise<void> {
  await dbPut(STORE_SEEN, `${prefix}seen`, Array.from(set));
}

export function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

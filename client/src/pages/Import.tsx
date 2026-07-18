import { useRef, useState, useEffect, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ImportFileResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen,
  FileUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from "lucide-react";

// ─── Расширяем типизацию input для webkitdirectory ───────────────────────────
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

// ─── Типы ────────────────────────────────────────────────────────────────────
type LogLevel = "info" | "ok" | "skip" | "error";
type LogEntry = { ts: number; level: LogLevel; text: string };
type Counters = { total: number; queued: number; imported: number; skipped: number; failed: number };
type ImportMode = "idle" | "scanning" | "importing";

const FSA_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;
const DB_NAME = "lmu-import-db";
const DB_VERSION = 1;
const STORE_HANDLE = "dirHandle";
const STORE_SEEN = "seenFiles";
const AUTO_INTERVAL_MS = 30_000;

/**
 * Убирает из сообщения об ошибке длинный XML-контент.
 * Оставляет только первые 300 символов до первого '<' (если есть).
 */
function trimErrorMessage(msg: string): string {
  const xmlStart = msg.indexOf("<");
  if (xmlStart === -1) return msg;
  const prefix = msg.slice(0, xmlStart).trim();
  return prefix.length > 0 ? prefix : msg.slice(0, 300);
}

// ─── IndexedDB helpers ───────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_HANDLE);
      req.result.createObjectStore(STORE_SEEN);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetSeenSet(): Promise<Set<string>> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SEEN, "readonly");
    const req = tx.objectStore(STORE_SEEN).get("seen");
    req.onsuccess = () => resolve(new Set<string>(req.result ?? []));
    req.onerror = () => resolve(new Set());
  });
}

async function dbSaveSeenSet(set: Set<string>): Promise<void> {
  await dbPut(STORE_SEEN, "seen", Array.from(set));
}

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

// ─── Компонент ───────────────────────────────────────────────────────────────
export default function Import() {
  const { toast } = useToast();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FSA-состояние
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [dirPerm, setDirPerm] = useState<"granted" | "prompt" | "denied" | null>(null);
  const [autoImport, setAutoImport] = useState(false);

  // Журнал
  const [log, setLog] = useState<LogEntry[]>([]);
  const [counters, setCounters] = useState<Counters>({ total: 0, queued: 0, imported: 0, skipped: 0, failed: 0 });
  const [mode, setMode] = useState<ImportMode>("idle");
  const [clearingDb, setClearingDb] = useState(false);

  const addLog = useCallback((level: LogLevel, text: string) => {
    setLog((prev) => [...prev, { ts: Date.now(), level, text }]);
  }, []);

  // ─── Восстановить dirHandle из IndexedDB ─────────────────────────────────
  useEffect(() => {
    if (!FSA_SUPPORTED) return;
    (async () => {
      try {
        const saved = await dbGet<FileSystemDirectoryHandle>(STORE_HANDLE, "dir");
        if (!saved) return;
        setDirHandle(saved);
        setDirName(saved.name);
        const perm = await (saved as FileSystemDirectoryHandle & {
          queryPermission: (d: { mode: string }) => Promise<PermissionState>;
        }).queryPermission({ mode: "read" });
        setDirPerm(perm);
      } catch {
        // нет сохранённого handle
      }
    })();
  }, []);

  // ─── FSA: выбор папки ─────────────────────────────────────────────────────
  async function pickFolderFSA() {
    if (!FSA_SUPPORTED) return;
    try {
      const handle = await (window as Window & {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker();
      setDirHandle(handle);
      setDirName(handle.name);
      await dbPut(STORE_HANDLE, "dir", handle);
      const perm = await (handle as FileSystemDirectoryHandle & {
        queryPermission: (d: { mode: string }) => Promise<PermissionState>;
      }).queryPermission({ mode: "read" });
      setDirPerm(perm);
      addLog("info", `Папка выбрана: ${handle.name}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        addLog("error", `Ошибка выбора папки: ${e.message}`);
      }
    }
  }

  // ─── FSA: запросить разрешение ────────────────────────────────────────────
  async function requestPermission(): Promise<boolean> {
    if (!dirHandle) return false;
    try {
      const perm = await (dirHandle as FileSystemDirectoryHandle & {
        requestPermission: (d: { mode: string }) => Promise<PermissionState>;
      }).requestPermission({ mode: "read" });
      setDirPerm(perm);
      return perm === "granted";
    } catch {
      return false;
    }
  }

  // ─── Стриминговый импорт файлов ──────────────────────────────────────────
  const importFiles = useCallback(
    async (files: File[], seenSet?: Set<string>) => {
      const xmlFiles = files.filter((f) => f.name.toLowerCase().endsWith(".xml"));
      if (xmlFiles.length === 0) {
        addLog("info", "Файлов .xml не найдено");
        return;
      }

      const localSeen = seenSet ?? (await dbGetSeenSet());
      const newFiles = xmlFiles.filter((f) => !localSeen.has(fileKey(f)));

      if (newFiles.length === 0) {
        addLog("info", "Новых файлов нет — всё уже импортировано");
        return;
      }

      addLog("info", `Обнаружено новых файлов: ${newFiles.length}`);
      setCounters((c) => ({ ...c, total: c.total + newFiles.length, queued: c.queued + newFiles.length }));
      setMode("importing");

      for (const file of newFiles) {
        addLog("info", `Импорт: ${file.name}`);
        try {
          const content = await file.text();
          const res = await apiRequest("POST", "/api/import", {
            files: [{ fileName: file.name, content }],
          });
          const data: { results: ImportFileResult[]; imported: number; skipped: number; totalLaps: number } =
            await res.json();
          const r = data.results[0];
          if (r?.ok) {
            addLog("ok", `✓ ${file.name} — ${r.event ?? r.venue ?? ""} · кругов: ${r.laps ?? 0}`);
            setCounters((c) => ({ ...c, queued: c.queued - 1, imported: c.imported + data.imported }));
          } else {
            const skipMsg = trimErrorMessage(r?.message ?? "пропущен");
            addLog("skip", `↷ ${file.name} — ${skipMsg}`);
            setCounters((c) => ({ ...c, queued: c.queued - 1, skipped: c.skipped + 1 }));
          }
          localSeen.add(fileKey(file));
          await dbSaveSeenSet(localSeen);
        } catch (e: unknown) {
          const rawMsg = e instanceof Error ? e.message : String(e);
          const msg = trimErrorMessage(rawMsg);
          addLog("error", `✗ ${file.name} — ${msg}`);
          setCounters((c) => ({ ...c, queued: c.queued - 1, failed: c.failed + 1 }));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setMode("idle");
      addLog("info", "Импорт завершён");
    },
    [addLog]
  );

  // ─── Очистка БД ───────────────────────────────────────────────────────────
  const clearDatabase = useCallback(async () => {
    if (
      !window.confirm(
        "Удалить все импортированные данные из БД? Будут удалены все сессии, круги, трассы и связанные записи. Это действие необратимо."
      )
    ) return;
    setClearingDb(true);
    addLog("info", "Очистка БД…");
    try {
      await apiRequest("DELETE", "/api/import/all", undefined);
      await dbSaveSeenSet(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setCounters({ total: 0, queued: 0, imported: 0, skipped: 0, failed: 0 });
      addLog("ok", "✓ БД успешно очищена");
      toast({ title: "БД очищена", description: "Все импортированные данные удалены." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? trimErrorMessage(e.message) : String(e);
      addLog("error", `✗ Ошибка очистки БД: ${msg}`);
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setClearingDb(false);
    }
  }, [addLog, toast]);

  // ─── Скан FSA-папки ───────────────────────────────────────────────────────
  const scanFSAFolder = useCallback(async () => {
    if (!dirHandle) return;
    addLog("info", `Сканирую папку: ${dirHandle.name}`);
    setMode("scanning");
    try {
      let perm = dirPerm;
      if (perm !== "granted") {
        const ok = await requestPermission();
        if (!ok) {
          addLog("error", "Нет разрешения на чтение папки. Нажмите «Разрешить доступ».");
          setMode("idle");
          return;
        }
        perm = "granted";
      }
      const files: File[] = [];
      for await (const [, entry] of (dirHandle as FileSystemDirectoryHandle & {
        [Symbol.asyncIterator]?: never;
        entries: () => AsyncIterable<[string, FileSystemHandle]>;
      }).entries()) {
        if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".xml")) {
          const fh = entry as FileSystemFileHandle;
          files.push(await fh.getFile());
        }
      }
      addLog("info", `Найдено .xml файлов: ${files.length}`);
      setMode("idle");
      await importFiles(files);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog("error", `Ошибка сканирования: ${msg}`);
      setMode("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirHandle, dirPerm, importFiles]);

  // ─── Авто-импорт: таймер ─────────────────────────────────────────────────
  useEffect(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    if (!autoImport || !dirHandle) return;

    const tick = async () => {
      if (mode === "idle") await scanFSAFolder();
      autoTimerRef.current = setTimeout(tick, AUTO_INTERVAL_MS);
    };
    autoTimerRef.current = setTimeout(tick, AUTO_INTERVAL_MS);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [autoImport, dirHandle, mode, scanFSAFolder]);

  // ─── Fallback: обычный input ──────────────────────────────────────────────
  async function handleFileInput(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setMode("scanning");
    addLog("info", `Выбрано файлов: ${fileList.length}`);
    const files = Array.from(fileList);
    setMode("idle");
    await importFiles(files);
  }

  // ─── Цвет лога ───────────────────────────────────────────────────────────
  function logColor(level: LogLevel) {
    if (level === "ok") return "text-emerald-400";
    if (level === "error") return "text-red-400";
    if (level === "skip") return "text-yellow-400";
    return "text-card-foreground";
  }

  const modeLabel =
    mode === "scanning" ? "Сканирование…" : mode === "importing" ? "Импорт…" : "Ожидание";

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          Импорт логов игры
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Подключите папку с логами результатов LMU. Файлы .xml импортируются поочерёдно.
        </p>
      </div>

      {/* Предупреждение об очистке БД */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <div className="text-sm">
              <p className="text-card-foreground font-medium">Очистка базы данных</p>
              <p className="mt-1 text-muted-foreground">
                Будут удалены все импортированные данные: сессии, круги, трассы и связанные записи.
                Действие необратимо. После очистки файлы можно импортировать заново.
              </p>
            </div>
          </div>

          <button
            data-testid="button-clear-db"
            onClick={clearDatabase}
            disabled={clearingDb || mode !== "idle"}
            className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-40"
          >
            {clearingDb ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Очистить БД
          </button>
        </div>
      </div>

      {/* Подсказка */}
      <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-card-foreground">Где лежат логи результатов</p>
          <p className="mt-1 font-data text-xs">…\Le Mans Ultimate\UserData\Log\Results\*.xml</p>
          <p className="mt-2">
            Выберите папку — браузер подтянет все .xml файлы. Данные импортируются по одному без
            загрузки всего содержимого в память. Повторная загрузка пропускается.
          </p>
        </div>
      </div>

      {/* FSA: выбор папки */}
      {FSA_SUPPORTED ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              data-testid="button-pick-folder-fsa"
              onClick={pickFolderFSA}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover-elevate"
            >
              <FolderOpen size={16} /> Выбрать папку с логами
            </button>

            {dirHandle && (
              <button
                data-testid="button-scan-now"
                onClick={scanFSAFolder}
                disabled={mode !== "idle"}
                className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate disabled:opacity-50"
              >
                <RefreshCw size={16} className={mode !== "idle" ? "animate-spin" : ""} />
                Сканировать сейчас
              </button>
            )}

            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept=".xml"
              className="hidden"
              data-testid="input-files"
              onChange={(e) => handleFileInput(e.target.files)}
            />
            <button
              data-testid="button-pick-files"
              onClick={() => filesInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate"
            >
              <FileUp size={16} /> Выбрать файлы вручную
            </button>
          </div>

          {/* Статус выбранной папки */}
          {dirName && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm">
              <FolderOpen size={14} className="shrink-0 text-primary" />
              <span className="font-data text-xs text-card-foreground truncate">{dirName}</span>
              {dirPerm === "granted" ? (
                <CheckCircle2 size={14} className="ml-auto shrink-0 text-emerald-500" />
              ) : (
                <button
                  onClick={requestPermission}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <AlertTriangle size={13} /> Разрешить доступ
                </button>
              )}
            </div>
          )}

          {/* Авто-импорт */}
          <label className={`flex items-center gap-3 text-sm ${!dirHandle ? "opacity-40 pointer-events-none" : ""}` }>
            <input
              type="checkbox"
              checked={autoImport}
              disabled={!dirHandle}
              onChange={(e) => {
                setAutoImport(e.target.checked);
                addLog("info", e.target.checked ? "Автозагрузка включена" : "Автозагрузка выключена");
              }}
              className="h-4 w-4 rounded border-border accent-primary"
              data-testid="toggle-auto-import"
            />
            <span className="text-card-foreground">Автозагрузка логов</span>
            <span className="text-xs text-muted-foreground">(каждые {AUTO_INTERVAL_MS / 1000} с)</span>
          </label>
        </div>
      ) : (
        // ─── Fallback для браузеров без FSA ──────────────────────────────
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              Автоматическое фоновое сканирование недоступно — требуется браузер на основе Chromium с
              поддержкой File System Access API. Используйте ручной выбор файлов или папки ниже.
            </p>
          </div>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            className="hidden"
            data-testid="input-folder"
            onChange={(e) => handleFileInput(e.target.files)}
          />
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".xml"
            className="hidden"
            data-testid="input-files"
            onChange={(e) => handleFileInput(e.target.files)}
          />
          <div className="flex flex-wrap gap-3">
            <button
              data-testid="button-pick-folder"
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover-elevate"
            >
              <FolderOpen size={16} /> Выбрать папку с логами
            </button>
            <button
              data-testid="button-pick-files"
              onClick={() => filesInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate"
            >
              <FileUp size={16} /> Выбрать отдельные файлы
            </button>
          </div>
        </div>
      )}

      {/* Счётчики */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Обнаружено" value={counters.total} tone="muted" />
        <StatCard label="В очереди" value={counters.queued} tone="muted" />
        <StatCard label="Импортировано" value={counters.imported} tone="ok" />
        <StatCard label="Пропущено" value={counters.skipped} tone="muted" />
        <StatCard label="Ошибки" value={counters.failed} tone="err" />
      </div>

      {/* Статус режима */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {mode !== "idle" && <Loader2 size={13} className="animate-spin" />}
        <span>Статус: <span className="text-card-foreground">{modeLabel}</span></span>
        {autoImport && <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-primary text-[10px]">AUTO</span>}
      </div>

      {/* Журнал */}
      {log.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>Журнал импорта</span>
            <div className="flex items-center gap-3">
              {/* Кнопка очистки только журнала */}
              <button
                onClick={() => {
                  setLog([]);
                  setCounters({ total: 0, queued: 0, imported: 0, skipped: 0, failed: 0 });
                }}
                className="text-xs text-muted-foreground hover:text-card-foreground"
              >
                Очистить журнал
              </button>
            </div>
          </div>
          <ul
            className="max-h-72 divide-y divide-border overflow-y-auto"
            data-testid="import-log"
          >
            {[...log].reverse().map((entry, i) => (
              <li key={i} className={`flex items-start gap-2 px-4 py-2 text-xs ${logColor(entry.level)}`}>
                <span className="shrink-0 font-data text-muted-foreground">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "accent" | "muted" | "err";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-500"
      : tone === "accent"
      ? "text-primary"
      : tone === "err"
      ? "text-red-500"
      : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-data text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { promptAdminToken, clearStoredAdminToken } from "@/lib/adminToken";
import type { ImportFileResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { dbGet, dbGetSeenSet, dbPut, dbSaveSeenSet, fileKey, STORE_HANDLE } from "@/lib/importDb";

/**
 * Движок импорта XML-логов (папка/файлы, авто-скан, журнал, счётчики) —
 * вынесен из client/src/pages/Import.tsx выше роутера (см. LogImportEngineProvider
 * в App.tsx), чтобы переход между страницами приложения не размонтировал
 * компонент и не обрывал фоновый импорт/авто-скан на полпути.
 */

export type LogLevel = "info" | "ok" | "skip" | "error";
export type LogEntry = { ts: number; level: LogLevel; text: string };
export type Counters = { total: number; queued: number; imported: number; skipped: number; failed: number };

export const FSA_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;
export const AUTO_INTERVAL_MS = 30_000;

const LS_LOG_KEY = "lmu-import-log";
const LS_COUNTERS_KEY = "lmu-import-counters";
const MAX_LOG_ENTRIES = 500;

const DEFAULT_COUNTERS: Counters = { total: 0, queued: 0, imported: 0, skipped: 0, failed: 0 };

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LS_LOG_KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]): void {
  try {
    const trimmed = entries.slice(-MAX_LOG_ENTRIES);
    localStorage.setItem(LS_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

function loadCounters(): Counters {
  try {
    const raw = localStorage.getItem(LS_COUNTERS_KEY);
    return raw ? (JSON.parse(raw) as Counters) : { ...DEFAULT_COUNTERS };
  } catch {
    return { ...DEFAULT_COUNTERS };
  }
}

function saveCounters(c: Counters): void {
  try {
    localStorage.setItem(LS_COUNTERS_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

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

export interface LogImportEngineState {
  dirHandle: FileSystemDirectoryHandle | null;
  dirName: string | null;
  dirPerm: "granted" | "prompt" | "denied" | null;
  autoImport: boolean;
  log: LogEntry[];
  counters: Counters;
  mode: "idle" | "scanning" | "importing";
  clearingDb: boolean;
  pickFolderFSA: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  scanFSAFolder: () => Promise<void>;
  importFiles: (files: File[]) => Promise<void>;
  clearDatabase: () => Promise<void>;
  setAutoImport: (v: boolean) => void;
  addLog: (level: LogLevel, text: string) => void;
  clearLog: () => void;
}

function useLogImportEngineInternal(): LogImportEngineState {
  const { t } = useLanguage();
  const { toast } = useToast();
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [dirPerm, setDirPerm] = useState<"granted" | "prompt" | "denied" | null>(null);
  const [autoImport, setAutoImport] = useState(false);

  const [log, setLogState] = useState<LogEntry[]>(() => loadLog());
  const [counters, setCountersState] = useState<Counters>(() => loadCounters());
  const [mode, setMode] = useState<"idle" | "scanning" | "importing">("idle");
  const [clearingDb, setClearingDb] = useState(false);

  const setLog = useCallback((updater: (prev: LogEntry[]) => LogEntry[]) => {
    setLogState((prev) => {
      const next = updater(prev);
      saveLog(next);
      return next;
    });
  }, []);

  const setCounters = useCallback((updater: (prev: Counters) => Counters) => {
    setCountersState((prev) => {
      const next = updater(prev);
      saveCounters(next);
      return next;
    });
  }, []);

  const addLog = useCallback((level: LogLevel, text: string) => {
    setLog((prev) => [...prev, { ts: Date.now(), level, text }]);
  }, [setLog]);

  const clearLog = useCallback(() => {
    setLogState([]);
    saveLog([]);
    setCountersState(DEFAULT_COUNTERS);
    saveCounters(DEFAULT_COUNTERS);
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
      const handle = await (window as unknown as Window & {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker();
      setDirHandle(handle);
      setDirName(handle.name);
      await dbPut(STORE_HANDLE, "dir", handle);
      const perm = await (handle as FileSystemDirectoryHandle & {
        queryPermission: (d: { mode: string }) => Promise<PermissionState>;
      }).queryPermission({ mode: "read" });
      setDirPerm(perm);
      addLog("info", t("imp.logFolderPicked", { name: handle.name }));
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        addLog("error", t("imp.logFolderPickError", { msg: e.message }));
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
        addLog("info", t("imp.logNoXmlFiles"));
        return;
      }

      const localSeen = seenSet ?? (await dbGetSeenSet(""));
      const alreadySeenFiles = xmlFiles.filter((f) => localSeen.has(fileKey(f)));
      const newFiles = xmlFiles.filter((f) => !localSeen.has(fileKey(f)));

      if (alreadySeenFiles.length > 0) {
        setCounters((c) => ({
          ...c,
          total: c.total + alreadySeenFiles.length,
          skipped: c.skipped + alreadySeenFiles.length,
        }));
        for (const file of alreadySeenFiles) {
          addLog("skip", t("imp.logImportSkip", { name: file.name, msg: t("imp.logImportSkipLocalDuplicate") }));
        }
      }

      if (newFiles.length === 0) {
        addLog("info", t("imp.logNoNewFiles"));
        return;
      }

      addLog("info", t("imp.logNewFilesFound", { n: newFiles.length }));
      setCounters((c) => ({ ...c, total: c.total + newFiles.length, queued: c.queued + newFiles.length }));
      setMode("importing");

      for (const file of newFiles) {
        addLog("info", t("imp.logImporting", { name: file.name }));
        try {
          const content = await file.text();
          const res = await apiRequest("POST", "/api/import", {
            files: [{ fileName: file.name, content }],
          });
          const data: { results: ImportFileResult[]; imported: number; skipped: number; totalLaps: number } =
            await res.json();
          const r = data.results[0];
          if (r?.skipped) {
            const skipMsg = trimErrorMessage(r?.message ?? t("imp.logImportSkipDefault"));
            addLog("skip", t("imp.logImportSkip", { name: file.name, msg: skipMsg }));
            setCounters((c) => ({ ...c, queued: c.queued - 1, skipped: c.skipped + 1 }));
          } else if (r?.ok) {
            addLog("ok", t("imp.logImportOk", {
              name: file.name,
              event: r.event ?? r.venue ?? "",
              sessionType: r.sessionType ?? "",
              drivers: r.drivers ?? 0,
              n: r.laps ?? 0,
            }));
            setCounters((c) => ({ ...c, queued: c.queued - 1, imported: c.imported + 1 }));
          } else {
            const errMsg = trimErrorMessage(r?.message ?? t("imp.logImportErrorDefault"));
            addLog("error", t("imp.logImportError", { name: file.name, msg: errMsg }));
            setCounters((c) => ({ ...c, queued: c.queued - 1, failed: c.failed + 1 }));
          }
          localSeen.add(fileKey(file));
          await dbSaveSeenSet(localSeen, "");
        } catch (e: unknown) {
          const rawMsg = e instanceof Error ? e.message : String(e);
          const msg = trimErrorMessage(rawMsg);
          addLog("error", t("imp.logImportError", { name: file.name, msg }));
          setCounters((c) => ({ ...c, queued: c.queued - 1, failed: c.failed + 1 }));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setMode("idle");
      addLog("info", t("imp.logImportDone"));
    },
    [addLog, setCounters, t]
  );

  // ─── Очистка БД ───────────────────────────────────────────────────────────
  const clearDatabase = useCallback(async () => {
    if (!window.confirm(t("imp.confirmClearDb"))) return;
    const token = promptAdminToken(t("imp.adminTokenPrompt"));
    if (!token) return;
    setClearingDb(true);
    addLog("info", t("imp.logClearingDb"));
    try {
      await apiRequest("DELETE", "/api/import/all", undefined, { Authorization: `Bearer ${token}` });
      await dbSaveSeenSet(new Set(), "");
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setCountersState(DEFAULT_COUNTERS);
      saveCounters(DEFAULT_COUNTERS);
      addLog("ok", t("imp.logDbCleared"));
      toast({ title: t("imp.toastDbClearedTitle"), description: t("imp.toastDbClearedDesc") });
    } catch (e: unknown) {
      const msg = e instanceof Error ? trimErrorMessage(e.message) : String(e);
      if (msg.startsWith("401")) clearStoredAdminToken();
      addLog("error", t("imp.logDbClearError", { msg }));
      toast({ title: t("imp.toastErrorTitle"), description: msg, variant: "destructive" });
    } finally {
      setClearingDb(false);
    }
  }, [addLog, toast, t]);

  // ─── Скан FSA-папки ───────────────────────────────────────────────────────
  const scanFSAFolder = useCallback(async () => {
    if (!dirHandle) return;
    addLog("info", t("imp.logScanningFolder", { name: dirHandle.name }));
    setMode("scanning");
    try {
      let perm = dirPerm;
      if (perm !== "granted") {
        const ok = await requestPermission();
        if (!ok) {
          addLog("error", t("imp.logNoPermission"));
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
      addLog("info", t("imp.logXmlFound", { n: files.length }));
      setMode("idle");
      await importFiles(files);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog("error", t("imp.logScanError", { msg }));
      setMode("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirHandle, dirPerm, importFiles, t]);

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

  return {
    dirHandle,
    dirName,
    dirPerm,
    autoImport,
    log,
    counters,
    mode,
    clearingDb,
    pickFolderFSA,
    requestPermission,
    scanFSAFolder,
    importFiles,
    clearDatabase,
    setAutoImport,
    addLog,
    clearLog,
  };
}

const LogImportEngineContext = createContext<LogImportEngineState | null>(null);

export function LogImportEngineProvider({ children }: { children: ReactNode }) {
  const engine = useLogImportEngineInternal();
  return <LogImportEngineContext.Provider value={engine}>{children}</LogImportEngineContext.Provider>;
}

export function useLogImportEngine(): LogImportEngineState {
  const ctx = useContext(LogImportEngineContext);
  if (!ctx) throw new Error("useLogImportEngine must be used within LogImportEngineProvider");
  return ctx;
}

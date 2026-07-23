import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { API_BASE } from "@/lib/queryClient";
import { promptAdminToken, clearStoredAdminToken } from "@/lib/adminToken";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { dbGetSeenSet, dbSaveSeenSet, fileKey } from "@/lib/importDb";

/**
 * Движок импорта телеметрии (.duckdb) — вынесен из
 * client/src/components/TelemetryImportPanel.tsx выше роутера (см.
 * TelemetryImportEngineProvider в App.tsx) по тем же причинам, что и движок
 * логов (client/src/lib/logImportEngine.tsx): переход между страницами (и
 * переключение внутреннего таба "Логи/Телеметрия" на /import, которое тоже
 * размонтирует эту панель) не должен обрывать фоновый импорт.
 */

export type TelemetryLogLevel = "info" | "ok" | "skip" | "error";
export type TelemetryLogEntry = { ts: number; level: TelemetryLogLevel; text: string };
export type TelemetryCounters = { total: number; queued: number; imported: number; skipped: number; failed: number };

export const FSA_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;
const SEEN_KEY_PREFIX = "telemetry:";

const LS_LOG_KEY = "lmu-telemetry-import-log";
const LS_COUNTERS_KEY = "lmu-telemetry-import-counters";
const MAX_LOG_ENTRIES = 500;

const DEFAULT_COUNTERS: TelemetryCounters = { total: 0, queued: 0, imported: 0, skipped: 0, failed: 0 };

function loadLog(): TelemetryLogEntry[] {
  try {
    const raw = localStorage.getItem(LS_LOG_KEY);
    return raw ? (JSON.parse(raw) as TelemetryLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: TelemetryLogEntry[]): void {
  try {
    localStorage.setItem(LS_LOG_KEY, JSON.stringify(entries.slice(-MAX_LOG_ENTRIES)));
  } catch {
    // ignore quota errors
  }
}

function loadCounters(): TelemetryCounters {
  try {
    const raw = localStorage.getItem(LS_COUNTERS_KEY);
    return raw ? (JSON.parse(raw) as TelemetryCounters) : { ...DEFAULT_COUNTERS };
  } catch {
    return { ...DEFAULT_COUNTERS };
  }
}

function saveCounters(c: TelemetryCounters): void {
  try {
    localStorage.setItem(LS_COUNTERS_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function trimErrorMessage(msg: string): string {
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

type TelemetryImportResponse = {
  ok: boolean;
  fileName: string;
  message?: string;
  telemetrySessionId?: number;
  channelCount?: number;
  sampleCount?: number;
};

async function uploadTelemetryFile(file: File): Promise<TelemetryImportResponse> {
  const buffer = await file.arrayBuffer();
  const res = await fetch(`${API_BASE}/api/import/telemetry?fileName=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: buffer,
  });
  const data = (await res.json()) as TelemetryImportResponse;
  if (!res.ok && res.status !== 409) {
    throw new Error(data.message ?? `${res.status}: ${res.statusText}`);
  }
  return data;
}

export interface TelemetryImportEngineState {
  dirHandle: FileSystemDirectoryHandle | null;
  dirName: string | null;
  dirPerm: "granted" | "prompt" | "denied" | null;
  log: TelemetryLogEntry[];
  counters: TelemetryCounters;
  mode: "idle" | "scanning" | "importing";
  clearing: boolean;
  pickFolderFSA: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  scanFSAFolder: () => Promise<void>;
  importFiles: (files: File[]) => Promise<void>;
  clearTelemetry: () => Promise<void>;
  addLog: (level: TelemetryLogLevel, text: string) => void;
  clearLog: () => void;
}

function useTelemetryImportEngineInternal(): TelemetryImportEngineState {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [dirPerm, setDirPerm] = useState<"granted" | "prompt" | "denied" | null>(null);

  const [log, setLogState] = useState<TelemetryLogEntry[]>(() => loadLog());
  const [counters, setCountersState] = useState<TelemetryCounters>(() => loadCounters());
  const [mode, setMode] = useState<"idle" | "scanning" | "importing">("idle");
  const [clearing, setClearing] = useState(false);

  const setLog = useCallback((updater: (prev: TelemetryLogEntry[]) => TelemetryLogEntry[]) => {
    setLogState((prev) => {
      const next = updater(prev);
      saveLog(next);
      return next;
    });
  }, []);

  const setCounters = useCallback((updater: (prev: TelemetryCounters) => TelemetryCounters) => {
    setCountersState((prev) => {
      const next = updater(prev);
      saveCounters(next);
      return next;
    });
  }, []);

  const addLog = useCallback((level: TelemetryLogLevel, text: string) => {
    setLog((prev) => [...prev, { ts: Date.now(), level, text }]);
  }, [setLog]);

  const clearLog = useCallback(() => {
    setLogState([]);
    saveLog([]);
    setCountersState(DEFAULT_COUNTERS);
    saveCounters(DEFAULT_COUNTERS);
  }, []);

  const importFiles = useCallback(
    async (files: File[]) => {
      const duckdbFiles = files.filter((f) => f.name.toLowerCase().endsWith(".duckdb"));
      if (duckdbFiles.length === 0) {
        addLog("info", t("telemetry.logNoFiles"));
        return;
      }

      const seen = await dbGetSeenSet(SEEN_KEY_PREFIX);
      const newFiles = duckdbFiles.filter((f) => !seen.has(fileKey(f)));
      if (newFiles.length === 0) {
        addLog("info", t("telemetry.logNoNewFiles"));
        return;
      }

      addLog("info", t("telemetry.logNewFilesFound", { n: newFiles.length }));
      setCounters((c) => ({ ...c, total: c.total + newFiles.length, queued: c.queued + newFiles.length }));
      setMode("importing");

      for (const file of newFiles) {
        addLog("info", t("telemetry.logImporting", { name: file.name }));
        try {
          const data = await uploadTelemetryFile(file);
          if (data.ok) {
            addLog("ok", t("telemetry.logImportOk", {
              name: file.name,
              channels: data.channelCount ?? 0,
              samples: data.sampleCount ?? 0,
            }));
            setCounters((c) => ({ ...c, queued: c.queued - 1, imported: c.imported + 1 }));
          } else {
            addLog("skip", t("telemetry.logImportSkip", { name: file.name, msg: trimErrorMessage(data.message ?? "") }));
            setCounters((c) => ({ ...c, queued: c.queued - 1, skipped: c.skipped + 1 }));
          }
          seen.add(fileKey(file));
          await dbSaveSeenSet(seen, SEEN_KEY_PREFIX);
        } catch (e: unknown) {
          const msg = trimErrorMessage(e instanceof Error ? e.message : String(e));
          addLog("error", t("telemetry.logImportError", { name: file.name, msg }));
          setCounters((c) => ({ ...c, queued: c.queued - 1, failed: c.failed + 1 }));
        }
      }

      setMode("idle");
      addLog("info", t("telemetry.logImportDone"));
    },
    [addLog, setCounters, t]
  );

  const clearTelemetry = useCallback(async () => {
    if (!window.confirm(t("telemetry.confirmClear"))) return;
    const token = promptAdminToken(t("telemetry.adminTokenPrompt"));
    if (!token) return;
    setClearing(true);
    addLog("info", t("telemetry.logClearing"));
    try {
      const res = await fetch(`${API_BASE}/api/import/telemetry/all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      await dbSaveSeenSet(new Set(), SEEN_KEY_PREFIX);
      setCountersState(DEFAULT_COUNTERS);
      saveCounters(DEFAULT_COUNTERS);
      addLog("ok", t("telemetry.logCleared"));
      toast({ title: t("telemetry.toastClearedTitle"), description: t("telemetry.toastClearedDesc") });
    } catch (e: unknown) {
      const msg = e instanceof Error ? trimErrorMessage(e.message) : String(e);
      if (msg.startsWith("401")) clearStoredAdminToken();
      addLog("error", t("telemetry.logClearError", { msg }));
      toast({ title: t("imp.toastErrorTitle"), description: msg, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  }, [addLog, t, toast]);

  async function pickFolderFSA() {
    if (!FSA_SUPPORTED) return;
    try {
      const handle = await (window as unknown as Window & {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker();
      setDirHandle(handle);
      setDirName(handle.name);
      const perm = await (handle as FileSystemDirectoryHandle & {
        queryPermission: (d: { mode: string }) => Promise<PermissionState>;
      }).queryPermission({ mode: "read" });
      setDirPerm(perm);
      addLog("info", t("telemetry.logFolderPicked", { name: handle.name }));
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        addLog("error", t("telemetry.logFolderPickError", { msg: e.message }));
      }
    }
  }

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

  const scanFSAFolder = useCallback(async () => {
    if (!dirHandle) return;
    addLog("info", t("telemetry.logScanningFolder", { name: dirHandle.name }));
    setMode("scanning");
    try {
      let perm = dirPerm;
      if (perm !== "granted") {
        const ok = await requestPermission();
        if (!ok) {
          addLog("error", t("telemetry.logNoPermission"));
          setMode("idle");
          return;
        }
      }
      const files: File[] = [];
      for await (const [, entry] of (dirHandle as FileSystemDirectoryHandle & {
        entries: () => AsyncIterable<[string, FileSystemHandle]>;
      }).entries()) {
        if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".duckdb")) {
          files.push(await (entry as FileSystemFileHandle).getFile());
        }
      }
      addLog("info", t("telemetry.logFilesFound", { n: files.length }));
      setMode("idle");
      await importFiles(files);
    } catch (e: unknown) {
      addLog("error", t("telemetry.logScanError", { msg: e instanceof Error ? e.message : String(e) }));
      setMode("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirHandle, dirPerm, importFiles, t]);

  return {
    dirHandle,
    dirName,
    dirPerm,
    log,
    counters,
    mode,
    clearing,
    pickFolderFSA,
    requestPermission,
    scanFSAFolder,
    importFiles,
    clearTelemetry,
    addLog,
    clearLog,
  };
}

const TelemetryImportEngineContext = createContext<TelemetryImportEngineState | null>(null);

export function TelemetryImportEngineProvider({ children }: { children: ReactNode }) {
  const engine = useTelemetryImportEngineInternal();
  return <TelemetryImportEngineContext.Provider value={engine}>{children}</TelemetryImportEngineContext.Provider>;
}

export function useTelemetryImportEngine(): TelemetryImportEngineState {
  const ctx = useContext(TelemetryImportEngineContext);
  if (!ctx) throw new Error("useTelemetryImportEngine must be used within TelemetryImportEngineProvider");
  return ctx;
}

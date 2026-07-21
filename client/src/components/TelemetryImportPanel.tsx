import { useRef, useState, useCallback } from "react";
import { API_BASE } from "@/lib/queryClient";
import { promptAdminToken, clearStoredAdminToken } from "@/lib/adminToken";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen,
  FileUp,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

type LogLevel = "info" | "ok" | "skip" | "error";
type LogEntry = { ts: number; level: LogLevel; text: string };
type Counters = { total: number; queued: number; imported: number; skipped: number; failed: number };
type ImportMode = "idle" | "scanning" | "importing";

const FSA_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;
const DB_NAME = "lmu-import-db";
const DB_VERSION = 1;
const STORE_HANDLE = "dirHandle";
const STORE_SEEN = "seenFiles";
const SEEN_KEY_PREFIX = "telemetry:";

const LS_LOG_KEY = "lmu-telemetry-import-log";
const LS_COUNTERS_KEY = "lmu-telemetry-import-counters";
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
    localStorage.setItem(LS_LOG_KEY, JSON.stringify(entries.slice(-MAX_LOG_ENTRIES)));
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

function trimErrorMessage(msg: string): string {
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

// ─── IndexedDB helpers (общая БД с Import.tsx, ключи с префиксом telemetry:) ─
function openDB(): Promise<IDBDatabase> {
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

async function dbGetSeenSet(): Promise<Set<string>> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SEEN, "readonly");
    const req = tx.objectStore(STORE_SEEN).get(`${SEEN_KEY_PREFIX}seen`);
    req.onsuccess = () => resolve(new Set<string>(req.result ?? []));
    req.onerror = () => resolve(new Set());
  });
}

async function dbSaveSeenSet(set: Set<string>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SEEN, "readwrite");
    tx.objectStore(STORE_SEEN).put(Array.from(set), `${SEEN_KEY_PREFIX}seen`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
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

export default function TelemetryImportPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [dirPerm, setDirPerm] = useState<"granted" | "prompt" | "denied" | null>(null);

  const [log, setLogState] = useState<LogEntry[]>(() => loadLog());
  const [counters, setCountersState] = useState<Counters>(() => loadCounters());
  const [mode, setMode] = useState<ImportMode>("idle");
  const [clearing, setClearing] = useState(false);

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

  const importFiles = useCallback(
    async (files: File[]) => {
      const duckdbFiles = files.filter((f) => f.name.toLowerCase().endsWith(".duckdb"));
      if (duckdbFiles.length === 0) {
        addLog("info", t("telemetry.logNoFiles"));
        return;
      }

      const seen = await dbGetSeenSet();
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
          await dbSaveSeenSet(seen);
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
      await dbSaveSeenSet(new Set());
      const reset: Counters = { ...DEFAULT_COUNTERS };
      setCountersState(reset);
      saveCounters(reset);
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
      const handle = await (window as Window & {
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

  async function handleFileInput(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    addLog("info", t("telemetry.logFilesPicked", { n: fileList.length }));
    await importFiles(Array.from(fileList));
  }

  function logColor(level: LogLevel) {
    if (level === "ok") return "text-emerald-400";
    if (level === "error") return "text-red-400";
    if (level === "skip") return "text-yellow-400";
    return "text-card-foreground";
  }

  const modeLabel =
    mode === "scanning" ? t("imp.modeScanning") : mode === "importing" ? t("imp.modeImporting") : t("imp.modeIdle");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">{t("telemetry.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("telemetry.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div className="text-sm">
            <p className="text-card-foreground font-medium">{t("telemetry.cleanupTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("telemetry.cleanupBody")}</p>
          </div>
        </div>
        <button
          onClick={clearTelemetry}
          disabled={clearing || mode !== "idle"}
          className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-40"
        >
          {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {t("telemetry.cleanupCta")}
        </button>
      </div>

      {FSA_SUPPORTED ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={pickFolderFSA}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover-elevate"
            >
              <FolderOpen size={16} /> {t("imp.pickFolder")}
            </button>
            {dirHandle && (
              <button
                onClick={scanFSAFolder}
                disabled={mode !== "idle"}
                className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate disabled:opacity-50"
              >
                <RefreshCw size={16} className={mode !== "idle" ? "animate-spin" : ""} />
                {t("imp.scanNow")}
              </button>
            )}
            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept=".duckdb"
              className="hidden"
              onChange={(e) => handleFileInput(e.target.files)}
            />
            <button
              onClick={() => filesInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate"
            >
              <FileUp size={16} /> {t("imp.pickFiles")}
            </button>
          </div>

          {dirName && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm">
              <FolderOpen size={14} className="shrink-0 text-primary" />
              <span className="font-data text-xs text-card-foreground truncate">{dirName}</span>
              {dirPerm === "granted" ? (
                <CheckCircle2 size={14} className="ml-auto shrink-0 text-emerald-500" />
              ) : (
                <button onClick={requestPermission} className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
                  <AlertTriangle size={13} /> {t("imp.allowAccess")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{t("imp.noFsaWarning")}</p>
          </div>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => handleFileInput(e.target.files)}
          />
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".duckdb"
            className="hidden"
            onChange={(e) => handleFileInput(e.target.files)}
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover-elevate"
            >
              <FolderOpen size={16} /> {t("imp.pickFolder")}
            </button>
            <button
              onClick={() => filesInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate"
            >
              <FileUp size={16} /> {t("imp.pickFilesFallback")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label={t("imp.statDetected")} value={counters.total} tone="muted" />
        <StatCard label={t("imp.statQueued")} value={counters.queued} tone="muted" />
        <StatCard label={t("imp.statImported")} value={counters.imported} tone="ok" />
        <StatCard label={t("imp.statSkipped")} value={counters.skipped} tone="muted" />
        <StatCard label={t("imp.statErrors")} value={counters.failed} tone="err" />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {mode !== "idle" && <Loader2 size={13} className="animate-spin" />}
        <span>{t("imp.statusLabel")}: <span className="text-card-foreground">{modeLabel}</span></span>
      </div>

      {log.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>{t("imp.logTitle", { n: log.length })}</span>
            <button
              onClick={() => {
                setLogState([]);
                saveLog([]);
                const reset: Counters = { ...DEFAULT_COUNTERS };
                setCountersState(reset);
                saveCounters(reset);
              }}
              className="text-xs text-muted-foreground hover:text-card-foreground"
            >
              {t("imp.logClear")}
            </button>
          </div>
          <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto">
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

function StatCard({ label, value, tone }: { label: string; value: number; tone: "ok" | "accent" | "muted" | "err" }) {
  const color =
    tone === "ok" ? "text-emerald-500" : tone === "accent" ? "text-primary" : tone === "err" ? "text-red-500" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-data text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

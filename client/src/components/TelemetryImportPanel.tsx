import { useRef } from "react";
import { FolderOpen, FileUp, CheckCircle2, RefreshCw, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { FSA_SUPPORTED, useTelemetryImportEngine } from "@/lib/telemetryImportEngine";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- T должен повторять сигнатуру расширяемого интерфейса для корректного declaration merging
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

/**
 * Панель "Телеметрия" на /import: тонкий view над движком импорта телеметрии
 * (client/src/lib/telemetryImportEngine.tsx), вынесенным выше роутера — как
 * переход между вкладками приложения, так и переключение внутреннего таба
 * "Логи/Телеметрия" (которое размонтирует эту панель) больше не прерывают
 * фоновый импорт.
 */
export default function TelemetryImportPanel() {
  const { t } = useLanguage();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useTelemetryImportEngine();

  async function handleFileInput(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    addLog("info", t("telemetry.logFilesPicked", { n: fileList.length }));
    await importFiles(Array.from(fileList));
  }

  function logColor(level: "info" | "ok" | "skip" | "error") {
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
                <button
                  onClick={requestPermission}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                >
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
        <span>
          {t("imp.statusLabel")}: <span className="text-card-foreground">{modeLabel}</span>
        </span>
      </div>

      {log.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>{t("imp.logTitle", { n: log.length })}</span>
            <button onClick={clearLog} className="text-xs text-muted-foreground hover:text-card-foreground">
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

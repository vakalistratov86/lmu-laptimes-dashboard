import { useRef, useState } from "react";
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
  FileText,
  Activity,
  CircleSlash,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AUTO_INTERVAL_MS, FSA_SUPPORTED, useLogImportEngine, type LogLevel } from "@/lib/logImportEngine";
import TelemetryImportPanel from "@/components/TelemetryImportPanel";

type MainTab = "logs" | "telemetry";

// ─── Расширяем типизацию input для webkitdirectory ───────────────────────────
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- T должен повторять сигнатуру расширяемого интерфейса для корректного declaration merging
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

/**
 * Страница /import: тонкий view над движком импорта логов
 * (client/src/lib/logImportEngine.tsx), вынесенным выше роутера — навигация
 * между вкладками приложения больше не прерывает фоновый импорт/авто-скан,
 * т.к. состояние и цикл импорта больше не привязаны к жизненному циклу этой
 * страницы.
 */
export default function Import() {
  const { t } = useLanguage();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const engine = useLogImportEngine();
  const {
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
  } = engine;

  const [mainTab, setMainTab] = useState<MainTab>("logs");

  // ─── Fallback: обычный input ──────────────────────────────────────────────
  async function handleFileInput(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    addLog("info", t("imp.logFilesPicked", { n: fileList.length }));
    await importFiles(Array.from(fileList));
  }

  // ─── Цвет и иконка записи журнала ─────────────────────────────────────────
  // Иконка дублирует цвет для сканируемости и доступности (не полагаемся
  // только на цвет — важно для дальтоников и при беглом просмотре журнала).
  function logColor(level: LogLevel) {
    if (level === "ok") return "text-emerald-400";
    if (level === "error") return "text-red-400";
    if (level === "skip") return "text-yellow-400";
    if (level === "warn") return "text-amber-400";
    return "text-muted-foreground";
  }

  function LogIcon({ level }: { level: LogLevel }) {
    const cls = cn("shrink-0", logColor(level));
    if (level === "ok") return <CheckCircle2 size={14} className={cls} />;
    if (level === "error") return <XCircle size={14} className={cls} />;
    if (level === "skip") return <CircleSlash size={14} className={cls} />;
    if (level === "warn") return <AlertTriangle size={14} className={cls} />;
    return <Info size={14} className={cls} />;
  }

  const modeLabel =
    mode === "scanning" ? t("imp.modeScanning") : mode === "importing" ? t("imp.modeImporting") : t("imp.modeIdle");

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          {t("imp.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("imp.subtitle")}</p>
      </div>

      {/* Основные табы */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          data-testid="tab-import-logs"
          onClick={() => setMainTab("logs")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            mainTab === "logs"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FileText size={14} />
          {t("imp.tabLogs")}
        </button>
        <button
          data-testid="tab-import-telemetry"
          onClick={() => setMainTab("telemetry")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            mainTab === "telemetry"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Activity size={14} />
          {t("imp.tabTelemetry")}
        </button>
      </div>

      {mainTab === "telemetry" ? (
        <TelemetryImportPanel />
      ) : (
        <>
          {/* Предупреждение об очистке БД */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
                <div className="text-sm">
                  <p className="text-card-foreground font-medium">{t("imp.cleanupTitle")}</p>
                  <p className="mt-1 text-muted-foreground">{t("imp.cleanupBody")}</p>
                </div>
              </div>

              <button
                data-testid="button-clear-db"
                onClick={clearDatabase}
                disabled={clearingDb || mode !== "idle"}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-40"
              >
                {clearingDb ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t("imp.cleanupCta")}
              </button>
            </div>
          </div>

          {/* Подсказка */}
          <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <Info size={18} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-card-foreground">{t("imp.whereTitle")}</p>
              <p className="mt-1 font-data text-xs">{t("imp.wherePath")}</p>
              <p className="mt-2">{t("imp.whereBody")}</p>
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
                  <FolderOpen size={16} /> {t("imp.pickFolder")}
                </button>

                {dirHandle && (
                  <button
                    data-testid="button-scan-now"
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
                  <FileUp size={16} /> {t("imp.pickFiles")}
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
                      <AlertTriangle size={13} /> {t("imp.allowAccess")}
                    </button>
                  )}
                </div>
              )}

              {/* Авто-импорт */}
              <label
                className={`flex items-center gap-3 text-sm ${!dirHandle ? "opacity-40 pointer-events-none" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={autoImport}
                  disabled={!dirHandle}
                  onChange={(e) => {
                    setAutoImport(e.target.checked);
                    addLog("info", e.target.checked ? t("imp.logAutoOn") : t("imp.logAutoOff"));
                  }}
                  className="h-4 w-4 rounded border-border accent-primary"
                  data-testid="toggle-auto-import"
                />
                <span className="text-card-foreground">{t("imp.autoImport")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("imp.autoImportInterval", { n: AUTO_INTERVAL_MS / 1000 })}
                </span>
              </label>
            </div>
          ) : (
            // ─── Fallback для браузеров без FSA ──────────────────────────────
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
                  <FolderOpen size={16} /> {t("imp.pickFolder")}
                </button>
                <button
                  data-testid="button-pick-files"
                  onClick={() => filesInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate"
                >
                  <FileUp size={16} /> {t("imp.pickFilesFallback")}
                </button>
              </div>
            </div>
          )}

          {/* Счётчики */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatCard label={t("imp.statDetected")} value={counters.total} tone="muted" />
            <StatCard label={t("imp.statQueued")} value={counters.queued} tone="muted" />
            <StatCard label={t("imp.statImported")} value={counters.imported} tone="ok" />
            <StatCard label={t("imp.statSkipped")} value={counters.skipped} tone="muted" />
            <StatCard label={t("imp.statErrors")} value={counters.failed} tone="err" />
          </div>

          {/* Статус режима */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {mode !== "idle" && <Loader2 size={13} className="animate-spin" />}
            <span>
              {t("imp.statusLabel")}: <span className="text-card-foreground">{modeLabel}</span>
            </span>
            {autoImport && (
              <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-primary text-[10px]">AUTO</span>
            )}
          </div>

          {/* Журнал */}
          {log.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                <span>{t("imp.logTitle", { n: log.length })}</span>
                <div className="flex items-center gap-3">
                  <button onClick={clearLog} className="text-xs text-muted-foreground hover:text-card-foreground">
                    {t("imp.logClear")}
                  </button>
                </div>
              </div>
              <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto" data-testid="import-log">
                {[...log].reverse().map((entry, i) => (
                  <li key={i} className="flex items-start gap-2 px-4 py-2 text-xs hover-elevate">
                    <LogIcon level={entry.level} />
                    <span className="shrink-0 font-data text-muted-foreground">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                    <span className={logColor(entry.level)}>{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
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

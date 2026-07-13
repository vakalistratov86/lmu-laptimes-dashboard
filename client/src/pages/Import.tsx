import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ImportResponse, ImportFileResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, FileUp, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";

// Расширяем типизацию input для выбора папки
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

type PickedFile = { fileName: string; content: string };

const BATCH_SIZE = 20;

export default function Import() {
  const { toast } = useToast();
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportFileResult[] | null>(null);
  const [summary, setSummary] = useState<{ imported: number; skipped: number; totalLaps: number } | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setScanning(true);
    setResults(null);
    setSummary(null);
    const xmlFiles = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".xml")
    );
    const read: PickedFile[] = [];
    for (const f of xmlFiles) {
      try {
        const content = await f.text();
        read.push({ fileName: f.name, content });
      } catch {
        // пропускаем нечитаемые файлы
      }
    }
    setPicked(read);
    setScanning(false);
    if (read.length === 0) {
      toast({
        title: "Файлы .xml не найдены",
        description: "В выбранной папке нет логов результатов (.xml).",
        variant: "destructive",
      });
    }
  }

  const importMutation = useMutation({
    mutationFn: async (files: PickedFile[]) => {
      const all: ImportFileResult[] = [];
      let imported = 0;
      let skipped = 0;
      let totalLaps = 0;
      setProgress({ done: 0, total: files.length });
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const res = await apiRequest("POST", "/api/import", { files: batch });
        const data: ImportResponse = await res.json();
        all.push(...data.results);
        imported += data.imported;
        skipped += data.skipped;
        totalLaps += data.totalLaps;
        setProgress({ done: Math.min(i + BATCH_SIZE, files.length), total: files.length });
      }
      return { results: all, imported, skipped, totalLaps };
    },
    onSuccess: (data) => {
      setResults(data.results);
      setSummary({ imported: data.imported, skipped: data.skipped, totalLaps: data.totalLaps });
      setProgress(null);
      // Обновляем все связанные данные
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Импорт завершён",
        description: `Загружено сессий: ${data.imported}, кругов: ${data.totalLaps}. Пропущено: ${data.skipped}.`,
      });
    },
    onError: (err: Error) => {
      setProgress(null);
      toast({ title: "Ошибка импорта", description: err.message, variant: "destructive" });
    },
  });

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          Импорт логов игры
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Подключите папку с логами результатов LMU. Все файлы .xml будут разобраны и добавлены к данным.
        </p>
      </div>

      {/* Подсказка о расположении логов */}
      <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-card-foreground">Где лежат логи результатов</p>
          <p className="mt-1 font-data text-xs">
            …\Le Mans Ultimate\UserData\Log\Results\*.xml
          </p>
          <p className="mt-2">
            Выберите папку целиком — браузер сам подтянет все файлы. Данные обрабатываются локально и
            добавляются к текущим (демо‑данные сохраняются). Повторная загрузка того же файла пропускается.
          </p>
        </div>
      </div>

      {/* Выбор папки / файлов */}
      <div className="flex flex-wrap gap-3">
        <input
          ref={folderInput}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          className="hidden"
          data-testid="input-folder"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={filesInput}
          type="file"
          multiple
          accept=".xml"
          className="hidden"
          data-testid="input-files"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          data-testid="button-pick-folder"
          onClick={() => folderInput.current?.click()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover-elevate"
        >
          <FolderOpen size={16} /> Выбрать папку с логами
        </button>
        <button
          data-testid="button-pick-files"
          onClick={() => filesInput.current?.click()}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover-elevate"
        >
          <FileUp size={16} /> Выбрать отдельные файлы
        </button>
      </div>

      {/* Статус выбранных файлов */}
      {scanning && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Читаю файлы…
        </div>
      )}

      {!scanning && picked.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-card-foreground" data-testid="text-picked-count">
              Найдено файлов .xml: <span className="font-data font-semibold text-primary">{picked.length}</span>
            </p>
            <button
              data-testid="button-import"
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate(picked)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover-elevate disabled:opacity-60"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {progress ? `Импорт ${progress.done}/${progress.total}` : "Импорт…"}
                </>
              ) : (
                <>
                  <FileUp size={16} /> Импортировать
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Сводка результатов */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Загружено сессий" value={summary.imported} tone="ok" />
          <StatCard label="Кругов добавлено" value={summary.totalLaps} tone="accent" />
          <StatCard label="Пропущено" value={summary.skipped} tone="muted" />
        </div>
      )}

      {/* Детальный список результатов */}
      {results && results.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">
            <span>Файл</span>
            <span>
              Успешно: {okCount} · Ошибки: {failCount}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {results.map((r, i) => (
              <li
                key={`${r.fileName}-${i}`}
                className="flex items-center gap-3 px-4 py-3 text-sm"
                data-testid={`row-result-${i}`}
              >
                {r.ok ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                ) : (
                  <XCircle size={16} className="shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-data text-xs text-card-foreground">{r.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.ok
                      ? `${r.event ?? r.venue ?? ""} · пилотов: ${r.drivers ?? 0} · кругов: ${r.laps ?? 0}`
                      : r.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "ok" | "accent" | "muted" }) {
  const color =
    tone === "ok" ? "text-emerald-500" : tone === "accent" ? "text-primary" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-data text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

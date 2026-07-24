import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLogImportEngine } from "@/lib/logImportEngine";
import { useTelemetryImportEngine } from "@/lib/telemetryImportEngine";

/**
 * Общее состояние "идёт ли сейчас сканирование/импорт" — для индикатора
 * активности в хедере (иконка перехода на /import), который должен
 * показывать активность, даже если пользователь ушёл на другую страницу.
 *
 * С тех пор как оба движка импорта (логи и телеметрия, см.
 * client/src/lib/logImportEngine.tsx и client/src/lib/telemetryImportEngine.tsx)
 * вынесены в провайдеры уровня приложения, они смонтированы одновременно и
 * ВСЕГДА (а не только когда открыта соответствующая вкладка /import) —
 * поэтому у каждого движка теперь свой собственный, приватный mode, а этот
 * контекст лишь производное значение (agregate), а не источник истины:
 * общий записываемый mode гонялся бы, если оба импортёра активны одновременно
 * (например, фоновый авто-импорт логов тикает, пока пользователь вручную
 * сканирует телеметрию) — тот, кто первым закончит, сбросил бы mode в "idle"
 * даже если второй ещё работает.
 */
export type ImportActivityMode = "idle" | "scanning" | "importing";

interface ImportActivityContextValue {
  mode: ImportActivityMode;
}

const ImportActivityContext = createContext<ImportActivityContextValue | null>(null);

export function ImportActivityProvider({ children }: { children: ReactNode }) {
  const logEngine = useLogImportEngine();
  const telemetryEngine = useTelemetryImportEngine();
  const mode = useMemo<ImportActivityMode>(
    () => (logEngine.mode !== "idle" ? logEngine.mode : telemetryEngine.mode),
    [logEngine.mode, telemetryEngine.mode],
  );
  return <ImportActivityContext.Provider value={{ mode }}>{children}</ImportActivityContext.Provider>;
}

export function useImportActivity(): ImportActivityContextValue {
  const ctx = useContext(ImportActivityContext);
  if (!ctx) throw new Error("useImportActivity must be used within ImportActivityProvider");
  return ctx;
}

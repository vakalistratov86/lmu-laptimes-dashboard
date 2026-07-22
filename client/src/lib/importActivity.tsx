import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Общее состояние "идёт ли сейчас сканирование/импорт" — раньше жило только
 * внутри страницы /import (отдельно в Import.tsx и в TelemetryImportPanel.tsx),
 * из-за чего индикатор активности в хедере (иконка перехода на /import)
 * не мог показать, что фоновый процесс всё ещё идёт, если пользователь
 * ушёл на другую страницу. Обе панели пишут в один и тот же контекст —
 * они никогда не активны одновременно (разные вкладки одной страницы).
 */
export type ImportActivityMode = "idle" | "scanning" | "importing";

interface ImportActivityContextValue {
  mode: ImportActivityMode;
  setMode: (mode: ImportActivityMode) => void;
}

const ImportActivityContext = createContext<ImportActivityContextValue | null>(null);

export function ImportActivityProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ImportActivityMode>("idle");
  return (
    <ImportActivityContext.Provider value={{ mode, setMode }}>
      {children}
    </ImportActivityContext.Provider>
  );
}

export function useImportActivity(): ImportActivityContextValue {
  const ctx = useContext(ImportActivityContext);
  if (!ctx) throw new Error("useImportActivity must be used within ImportActivityProvider");
  return ctx;
}

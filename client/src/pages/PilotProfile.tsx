import { useState } from "react";
import { User } from "lucide-react";
import { DriverFilterBar } from "@/components/DriverFilterBar";
import { DriverProfile } from "@/components/DriverProfile";
import { useLanguage } from "@/lib/i18n";

export default function PilotProfile() {
  const { t } = useLanguage();

  // Не более одного пилота одновременно — Set того же интерфейса, что и у
  // DriverFilterBar в multi-режиме, но toggle заменяет выбор вместо добавления.
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<number>>(new Set());
  const selectedId = selectedDriverIds.size > 0 ? Array.from(selectedDriverIds)[0] : undefined;

  const toggleDriver = (id: number) => {
    setSelectedDriverIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
  };
  const clearDrivers = () => setSelectedDriverIds(new Set());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">{t("pilotProfile.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pilotProfile.subtitle")}</p>
      </div>

      <DriverFilterBar
        mode="single"
        selectedDriverIds={selectedDriverIds}
        onToggleDriver={toggleDriver}
        onClear={clearDrivers}
      />

      {selectedId == null ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User size={22} />
          </div>
          <p className="text-sm text-muted-foreground">{t("pilotProfile.empty")}</p>
        </div>
      ) : (
        <DriverProfile driverId={selectedId} />
      )}
    </div>
  );
}

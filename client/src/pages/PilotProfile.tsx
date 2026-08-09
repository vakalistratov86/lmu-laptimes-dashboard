import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { DriverFilterBar } from "@/components/DriverFilterBar";
import { DriverProfile } from "@/components/DriverProfile";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useDrivers } from "@/lib/api";
import { findOwnDriver } from "@/lib/driverMatch";

export default function PilotProfile() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: drivers } = useDrivers();

  // Не более одного пилота одновременно — Set того же интерфейса, что и у
  // DriverFilterBar в multi-режиме, но toggle заменяет выбор вместо добавления.
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<number>>(new Set());
  const selectedId = selectedDriverIds.size > 0 ? Array.from(selectedDriverIds)[0] : undefined;

  // Зарегистрированный пользователь должен увидеть свой профиль сразу, без
  // ручного выбора себя из списка — сопоставление по имени (displayName ===
  // drivers.name, см. lib/driverMatch), единственная доступная связь между
  // аккаунтом и игровым пилотом. autoSelectedRef гарантирует, что это
  // срабатывает один раз за визит на страницу — если пользователь потом сам
  // выберет другого пилота или сбросит выбор, авто-подстановка это не перебьёт.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current || selectedId != null) return;
    const own = findOwnDriver(user?.displayName, drivers);
    if (own) {
      autoSelectedRef.current = true;
      setSelectedDriverIds(new Set([own.id]));
    }
  }, [user, drivers, selectedId]);

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

import { useDrivers } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { cn } from "@/lib/utils";
import { Users, X } from "lucide-react";

export function DriverFilterBar() {
  const { data: drivers } = useDrivers();
  const { selectedDriverIds, toggleDriver, clearDrivers, isFiltered } = useDriverFilter();

  if (!drivers || drivers.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-background/70 px-4 py-2 backdrop-blur md:px-6"
      data-testid="driver-filter-bar"
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Users size={13} />
        <span>Пилоты</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {drivers.map((d) => {
          const active = selectedDriverIds.has(d.id);
          return (
            <button
              key={d.id}
              data-testid={`driver-chip-${d.id}`}
              onClick={() => toggleDriver(d.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {isFiltered && (
        <button
          onClick={clearDrivers}
          data-testid="driver-filter-clear"
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X size={12} /> Сбросить
        </button>
      )}
    </div>
  );
}

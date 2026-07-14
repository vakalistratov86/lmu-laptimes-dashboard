import { useState } from "react";
import { useDrivers } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export function DriverFilterBar() {
  const { data: drivers } = useDrivers();
  const { selectedDriverIds, toggleDriver, clearDrivers, isFiltered } = useDriverFilter();
  const [open, setOpen] = useState(false);

  if (!drivers || drivers.length === 0) return null;

  const selectedDrivers = drivers.filter((d) => selectedDriverIds.has(d.id));

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-background/70 px-4 py-2 backdrop-blur md:px-6"
      data-testid="driver-filter-bar"
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Users size={13} />
        <span>Пилоты</span>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-7 min-w-[160px] justify-between px-3 text-xs font-normal"
          >
            {selectedDrivers.length === 0
              ? "Выбрать пилотов…"
              : selectedDrivers.length === 1
              ? selectedDrivers[0].name
              : `${selectedDrivers.length} пилота выбрано`}
            <ChevronsUpDown size={12} className="ml-2 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Поиск пилота…" className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                Пилот не найден
              </CommandEmpty>
              <CommandGroup>
                {drivers.map((d) => {
                  const active = selectedDriverIds.has(d.id);
                  return (
                    <CommandItem
                      key={d.id}
                      value={d.name}
                      data-testid={`driver-chip-${d.id}`}
                      onSelect={() => toggleDriver(d.id)}
                      className="text-xs"
                    >
                      <Check
                        size={13}
                        className={cn(
                          "mr-2 shrink-0",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {d.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedDrivers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDrivers.map((d) => (
            <Badge
              key={d.id}
              variant="secondary"
              className="h-5 gap-1 px-2 text-[11px] font-normal"
            >
              {d.name}
              <button
                onClick={() => toggleDriver(d.id)}
                className="ml-0.5 rounded-full opacity-60 hover:opacity-100"
                aria-label={`Убрать ${d.name}`}
              >
                <X size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}

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

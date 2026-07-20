import { useState } from "react";
import { useDrivers } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { Check, ChevronsUpDown, Users, Bot, CheckCheck, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { DriverName } from "@/components/DriverName";
import { useLanguage } from "@/lib/i18n";

export function DriverFilterBar() {
  const { t, tn } = useLanguage();
  const { data: drivers } = useDrivers();
  const { selectedDriverIds, toggleDriver, setManyDrivers, clearDrivers, isFiltered } =
    useDriverFilter();
  const [open, setOpen] = useState(false);
  const [hideAI, setHideAI] = useState(false);

  if (!drivers || drivers.length === 0) return null;

  // isPlayer === 1 → реальный игрок; isPlayer === 0 → ИИ; isPlayer === null → demo (без данных сессий)
  const visibleDrivers = hideAI ? drivers.filter((d) => d.isPlayer === 1) : drivers;

  const selectedDrivers = drivers.filter((d) => selectedDriverIds.has(d.id));

  // «Выбрать все» действует на список, видимый сейчас с учётом переключателя ИИ
  // (независимо от текста поиска — иначе легко случайно выбрать не тех, кого ждёшь).
  const allVisibleSelected =
    visibleDrivers.length > 0 && visibleDrivers.every((d) => selectedDriverIds.has(d.id));

  // Разбивка списка: сначала уже выбранные (закреплены сверху), затем игроки, затем ИИ
  const selectedVisible = visibleDrivers.filter((d) => selectedDriverIds.has(d.id));
  const unselectedPlayers = visibleDrivers.filter(
    (d) => !selectedDriverIds.has(d.id) && d.isPlayer === 1,
  );
  const unselectedAI = visibleDrivers.filter(
    (d) => !selectedDriverIds.has(d.id) && d.isPlayer !== 1,
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-background/70 px-4 py-2 backdrop-blur md:px-6"
      data-testid="driver-filter-bar"
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Users size={13} />
        <span>{t("driverFilter.label")}</span>
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
              ? t("driverFilter.placeholderNone")
              : selectedDrivers.length === 1
              ? selectedDrivers[0].name
              : `${tn(selectedDrivers.length, "pilots")} ${t("driverFilter.selectedSuffix")}`}
            <ChevronsUpDown size={12} className="ml-2 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={t("driverFilter.searchPlaceholder")} className="h-8 text-xs" />

            {/* Переключатели — внутри выпадашки, рядом со списком, который они контролируют */}
            <div className="space-y-1.5 border-b border-border px-3 py-2">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Bot size={13} className="text-amber-400" />
                  {t("driverFilter.showAi")}
                </span>
                <Switch checked={!hideAI} onCheckedChange={(checked) => setHideAI(!checked)} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CheckCheck size={13} className="text-muted-foreground" />
                  {t("driverFilter.selectAll")}
                </span>
                <Switch
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) =>
                    setManyDrivers(
                      visibleDrivers.map((d) => d.id),
                      checked,
                    )
                  }
                />
              </label>
            </div>

            <CommandList>
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                {t("driverFilter.noResults")}
              </CommandEmpty>

              {selectedVisible.length > 0 && (
                <CommandGroup heading={t("driverFilter.selected")}>
                  {selectedVisible.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={d.name}
                      data-testid={`driver-chip-${d.id}`}
                      onSelect={() => toggleDriver(d.id)}
                      className="text-xs"
                    >
                      <Check size={13} className="mr-2 shrink-0 opacity-100" />
                      <DriverName name={d.name} isPlayer={d.isPlayer} />
                      <X size={12} className="ml-auto shrink-0 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {unselectedPlayers.length > 0 && (
                <CommandGroup heading={t("driverFilter.players")}>
                  {unselectedPlayers.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={d.name}
                      data-testid={`driver-chip-${d.id}`}
                      onSelect={() => toggleDriver(d.id)}
                      className="text-xs"
                    >
                      <Check size={13} className="mr-2 shrink-0 opacity-0" />
                      <DriverName name={d.name} isPlayer={d.isPlayer} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {unselectedAI.length > 0 && (
                <CommandGroup heading={t("driverFilter.ai")}>
                  {unselectedAI.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={d.name}
                      data-testid={`driver-chip-${d.id}`}
                      onSelect={() => toggleDriver(d.id)}
                      className="text-xs"
                    >
                      <Check size={13} className="mr-2 shrink-0 opacity-0" />
                      <DriverName name={d.name} isPlayer={d.isPlayer} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {isFiltered && (
        <button
          onClick={clearDrivers}
          data-testid="driver-filter-clear"
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X size={12} /> {t("driverFilter.reset")}
        </button>
      )}
    </div>
  );
}

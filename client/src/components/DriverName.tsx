import { cn } from "@/lib/utils";

interface DriverNameProps {
  name: string;
  isPlayer?: number | null;
  className?: string;
  badgeClassName?: string;
}

/**
 * Отображает имя пилота с меткой «ИИ» если isPlayer !== 1.
 * isPlayer=1 → живой игрок (без метки), isPlayer=0/null → ИИ.
 */
export function DriverName({ name, isPlayer, className, badgeClassName }: DriverNameProps) {
  const isAI = isPlayer !== 1;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {name}
      {isAI && (
        <span
          className={cn(
            "inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold uppercase leading-4 tracking-wide",
            "bg-amber-400/15 text-amber-400 border border-amber-400/30",
            badgeClassName
          )}
        >
          ИИ
        </span>
      )}
    </span>
  );
}

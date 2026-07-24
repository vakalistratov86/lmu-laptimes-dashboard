import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverNameProps {
  name: string;
  isPlayer?: number | null;
  className?: string;
  iconClassName?: string;
}

/**
 * Отображает имя пилота со значком типа: человек (зелёный) — реальный
 * игрок (isPlayer === 1), робот (жёлтый) — ИИ (isPlayer === 0 / null).
 * Единый стиль для всех списков пилотов в приложении. Имя всегда наследует
 * обычный адаптивный цвет текста — только значок кодирует тип пилота.
 */
export function DriverName({ name, isPlayer, className, iconClassName }: DriverNameProps) {
  const isReal = isPlayer === 1;
  const Icon = isReal ? User : Bot;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon size={13} className={cn("shrink-0", isReal ? "text-green-500" : "text-amber-400", iconClassName)} />
      {name}
    </span>
  );
}

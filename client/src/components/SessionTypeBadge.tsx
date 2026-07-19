import { Dumbbell, Timer, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  normalizeSessionCategory,
  getSessionTypeBadgeClass,
  SESSION_CATEGORY_LABEL,
  type SessionCategory,
} from "@/lib/classStyles";

const SESSION_CATEGORY_ICON: Record<SessionCategory, typeof Dumbbell> = {
  practice: Dumbbell,
  qualify: Timer,
  race: Trophy,
};

interface SessionTypeBadgeProps {
  /** Сырое значение session.sessionType из БД — нормализуется внутри. */
  sessionType: string;
  className?: string;
}

/**
 * Единая плашка типа сессии: одинаковый текст, цвет и ширина везде —
 * в списке сессий, в карточке сессии и в фильтре. Ширина фиксирована по
 * самому длинному варианту («Квалификация»), поэтому все три плашки
 * визуально одного размера независимо от длины слова.
 */
export function SessionTypeBadge({ sessionType, className }: SessionTypeBadgeProps) {
  const category = normalizeSessionCategory(sessionType);
  const Icon = SESSION_CATEGORY_ICON[category];

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex w-[124px] shrink-0 items-center justify-center gap-1.5 text-xs font-medium",
        getSessionTypeBadgeClass(category),
        className,
      )}
    >
      <Icon size={13} />
      {SESSION_CATEGORY_LABEL[category]}
    </Badge>
  );
}
